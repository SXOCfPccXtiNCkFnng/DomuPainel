import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { normalizePlanTier } from '@/lib/planLimits';
import { isBillingMockEnabled, asaasUpdateSubscriptionValue } from '@/lib/asaasClient';
import { sendEmail, appBaseUrl } from '@/lib/email';
import { brandedEmailHtml } from '@/lib/emailTemplates';
import { logger } from '@/lib/logger';
import { logOpsAlert } from '@/lib/opsAlert';

export const dynamic = 'force-dynamic';

const NOTICE_DAYS = 30;

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Atualiza o preço de um ou mais planos (tabela plan_prices) — vale na hora
 * pra cadastro novo e troca/reativação de plano.
 *
 * Para quem JÁ é assinante ACTIVE daquele plano:
 * - preço menor → aplica na hora (redução nunca precisa de aviso)
 * - preço maior → agenda pra daqui a 30 dias e avisa por e-mail agora; o cron
 *   /api/billing/apply-price-changes aplica de fato na data marcada.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const updates = body.prices as Record<string, unknown> | undefined;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Informe os preços a atualizar.' },
        { status: 400 }
      );
    }

    const rows: { plan_tier: string; price_brl: number }[] = [];
    for (const [tierRaw, valueRaw] of Object.entries(updates)) {
      const tier = normalizePlanTier(tierRaw);
      const value = Number(valueRaw);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json(
          { success: false, error: `Preço inválido para o plano ${tier}.` },
          { status: 400 }
        );
      }
      rows.push({ plan_tier: tier, price_brl: value });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum plano informado.' }, { status: 400 });
    }

    // 1. Preço "de tabela" pra cadastro novo — vale imediatamente.
    const { error: upsertErr } = await supabaseAdmin
      .from('plan_prices')
      .upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'plan_tier' }
      );
    if (upsertErr) throw upsertErr;

    let loweredNow = 0;
    let scheduledIncreases = 0;

    // 2. Assinantes ativos que já pagam por aquele plano.
    for (const { plan_tier: tier, price_brl: newPrice } of rows) {
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, asaas_subscription_id, monthly_price_brl')
        .eq('plan_tier', tier)
        .eq('status', 'ACTIVE');

      for (const sub of activeSubs || []) {
        const oldPrice = Number(sub.monthly_price_brl);
        if (!Number.isFinite(oldPrice) || oldPrice === newPrice) continue;

        if (newPrice < oldPrice) {
          // Redução: aplica na hora, sem aviso prévio (é a favor do cliente).
          try {
            if (!isBillingMockEnabled() && sub.asaas_subscription_id) {
              await asaasUpdateSubscriptionValue(sub.asaas_subscription_id, newPrice);
            }
            await supabaseAdmin
              .from('subscriptions')
              .update({ monthly_price_brl: newPrice, updated_at: new Date().toISOString() })
              .eq('tenant_id', sub.tenant_id);
            loweredNow += 1;
          } catch (err) {
            logger.error('interno.plan_price_lower_failed', {
              tenantId: sub.tenant_id,
              message: err instanceof Error ? err.message : String(err),
            });
            await logOpsAlert({
              source: 'interno.plan_prices',
              message: `Falha ao aplicar redução de preço para tenant ${sub.tenant_id}: ${err instanceof Error ? err.message : String(err)}`,
              tenantId: sub.tenant_id,
            });
          }
          continue;
        }

        // Aumento: agenda com aviso prévio.
        const effectiveAt = new Date(Date.now() + NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data: change, error: insertErr } = await supabaseAdmin
          .from('subscription_price_changes')
          .insert({
            tenant_id: sub.tenant_id,
            asaas_subscription_id: sub.asaas_subscription_id,
            plan_tier: tier,
            old_price_brl: oldPrice,
            new_price_brl: newPrice,
            effective_at: effectiveAt,
            created_by: gate.email,
          })
          .select('id')
          .single();

        if (insertErr || !change) {
          logger.error('interno.plan_price_schedule_failed', {
            tenantId: sub.tenant_id,
            message: insertErr?.message,
          });
          continue;
        }
        scheduledIncreases += 1;

        // Avisa por e-mail agora, na hora de agendar (não espera o cron).
        try {
          const { data: admins } = await supabaseAdmin
            .from('users')
            .select('email, name')
            .eq('tenant_id', sub.tenant_id)
            .eq('role', 'ADMIN');

          const recipients = (admins || []).map((a) => a.email).filter(Boolean);
          const expiresAt = formatDateBR(effectiveAt);
          const oldLabel = oldPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newLabel = newPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const base = appBaseUrl();

          for (const to of recipients) {
            await sendEmail({
              to,
              subject: `Aviso de reajuste — seu plano Domu Tech vai mudar em ${expiresAt}`,
              text: `Olá!\n\nO plano ${tier} vai passar de ${oldLabel} para ${newLabel}/mês a partir de ${expiresAt}. Isso dá o aviso prévio de ${NOTICE_DAYS} dias previsto nos nossos Termos de Uso. Se quiser cancelar antes disso, não haverá cobrança do novo valor.\n\nEquipe Domu Tech`,
              html: brandedEmailHtml({
                heading: 'Aviso de reajuste no seu plano',
                bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
                  <p style="margin:0 0 12px;">O plano <strong>${tier}</strong> vai passar de <strong>${oldLabel}</strong> para <strong>${newLabel}/mês</strong> a partir de <strong>${expiresAt}</strong>.</p>
                  <p style="margin:0 0 12px;">Isso respeita o aviso prévio de ${NOTICE_DAYS} dias previsto nos nossos Termos de Uso. Se preferir cancelar antes dessa data, não haverá cobrança do novo valor.</p>`,
                ctaLabel: 'Gerenciar assinatura',
                ctaUrl: `${base}/assinatura`,
              }),
            });
          }

          await supabaseAdmin
            .from('subscription_price_changes')
            .update({ notified_at: new Date().toISOString() })
            .eq('id', change.id);
        } catch (err) {
          logger.error('interno.plan_price_notify_failed', {
            tenantId: sub.tenant_id,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    logger.info('interno.plan_prices_updated', {
      byEmail: gate.email,
      prices: Object.fromEntries(rows.map((r) => [r.plan_tier, r.price_brl])),
      loweredNow,
      scheduledIncreases,
    });

    return NextResponse.json({ success: true, loweredNow, scheduledIncreases });
  } catch (error: unknown) {
    logger.error('interno.plan_prices_update_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Não foi possível salvar os preços.' },
      { status: 500 }
    );
  }
}
