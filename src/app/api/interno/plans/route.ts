import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platformAdmin';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getPlanDisplayName, normalizePlanTier, PlanTier } from '@/lib/planLimits';
import { getDefaultPlanPrices, getSegmentPriceOverrides, PLAN_TIERS } from '@/lib/planPricing';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { adjustSubscriptionPrice } from '@/lib/billing';
import { isBillingMockEnabled, asaasUpdateSubscriptionValue } from '@/lib/asaasClient';
import { sendEmail, appBaseUrl, contactFooterText } from '@/lib/email';
import { brandedEmailHtml, escapeHtml } from '@/lib/emailTemplates';
import { logger } from '@/lib/logger';
import { logOpsAlert } from '@/lib/opsAlert';

export const dynamic = 'force-dynamic';

const NOTICE_DAYS = 30;

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type PriceTable = Record<PlanTier, number>;
type Overrides = Record<string, Partial<Record<PlanTier, number>>>;

/** Preço que vale para um ramo: o próprio do ramo ou o padrão. */
function effectivePrice(segment: string | null, tier: PlanTier, defaults: PriceTable, overrides: Overrides): number {
  return (segment && overrides[segment]?.[tier]) || defaults[tier];
}

/** Ramos que podem ter preço próprio (Somente Disparos só tem Starter). */
function isPricedSegment(value: unknown): value is string {
  return typeof value === 'string' && value in SEGMENT_LABELS;
}

/** Tabela de preços: padrão + preços próprios de cada ramo. */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;
  const [defaults, overrides] = await Promise.all([getDefaultPlanPrices(), getSegmentPriceOverrides()]);
  return NextResponse.json({ success: true, defaults, overrides });
}

/**
 * Atualiza preços — o padrão (plan_prices) ou o de um ramo (segment_plan_prices).
 * Vale na hora pra cadastro novo e troca/reativação de plano.
 * Body: { segment?: 'imobiliario' | ... (vazio = padrão), prices: { STARTER: 197, PRO: null, ... } }
 * No ramo, preço vazio (null) volta a usar o padrão.
 *
 * Para quem JÁ é assinante ACTIVE e teve o preço do seu ramo alterado:
 * - preço menor → aplica na hora (redução nunca precisa de aviso)
 * - preço maior → agenda pra daqui a 30 dias e avisa por e-mail agora; o cron
 *   /api/billing/apply-price-changes aplica de fato na data marcada.
 */
export async function PATCH(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if ('error' in gate) return gate.error;

  try {
    const body = await req.json();
    const segment = body.segment ? String(body.segment) : null;
    if (segment && !isPricedSegment(segment)) {
      return NextResponse.json({ success: false, error: 'Ramo inválido.' }, { status: 400 });
    }
    const updates = body.prices as Record<string, unknown> | undefined;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Informe os preços a atualizar.' },
        { status: 400 }
      );
    }

    const rows: { plan_tier: PlanTier; price_brl: number | null }[] = [];
    for (const [tierRaw, valueRaw] of Object.entries(updates)) {
      const tier = normalizePlanTier(tierRaw);
      if (segment && (valueRaw === null || valueRaw === '')) {
        rows.push({ plan_tier: tier, price_brl: null });
        continue;
      }
      const value = Number(valueRaw);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json(
          { success: false, error: `Preço inválido para o plano ${getPlanDisplayName(tier)}.` },
          { status: 400 }
        );
      }
      rows.push({ plan_tier: tier, price_brl: Math.round(value * 100) / 100 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum plano informado.' }, { status: 400 });
    }

    // Tabela ANTES de salvar: só assinante cujo preço efetivo mudou é mexido.
    const [oldDefaults, oldOverrides] = await Promise.all([getDefaultPlanPrices(), getSegmentPriceOverrides()]);
    const now = new Date().toISOString();

    // 1. Preço de tabela pra cadastro novo — vale imediatamente.
    if (!segment) {
      const { error: upsertErr } = await supabaseAdmin
        .from('plan_prices')
        .upsert(
          rows.map((r) => ({ plan_tier: r.plan_tier, price_brl: r.price_brl, updated_at: now })),
          { onConflict: 'plan_tier' }
        );
      if (upsertErr) throw upsertErr;
    } else {
      const set = rows.filter((r) => r.price_brl != null);
      const cleared = rows.filter((r) => r.price_brl == null).map((r) => r.plan_tier);
      if (set.length) {
        const { error } = await supabaseAdmin
          .from('segment_plan_prices')
          .upsert(
            set.map((r) => ({ segment, plan_tier: r.plan_tier, price_brl: r.price_brl, updated_at: now })),
            { onConflict: 'segment,plan_tier' }
          );
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            return NextResponse.json(
              { success: false, error: 'Preço por ramo ainda não ativado no banco (migration 20261021_segment_plan_prices.sql).' },
              { status: 503 }
            );
          }
          throw error;
        }
      }
      if (cleared.length) {
        const { error } = await supabaseAdmin
          .from('segment_plan_prices')
          .delete()
          .eq('segment', segment)
          .in('plan_tier', cleared);
        if (error) throw error;
      }
    }

    const [newDefaults, newOverrides] = await Promise.all([getDefaultPlanPrices(), getSegmentPriceOverrides()]);

    let loweredNow = 0;
    let scheduledIncreases = 0;
    const changedTiers = PLAN_TIERS.filter((tier) =>
      [null, ...Object.keys(SEGMENT_LABELS)].some(
        (seg) => effectivePrice(seg, tier, oldDefaults, oldOverrides) !== effectivePrice(seg, tier, newDefaults, newOverrides)
      )
    );

    // 2. Assinantes ativos cujo preço (do ramo deles) mudou.
    for (const tier of changedTiers) {
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('tenant_id, asaas_subscription_id, monthly_price_brl')
        .eq('plan_tier', tier)
        .eq('status', 'ACTIVE');

      const tenantIds = (activeSubs || []).map((sub) => sub.tenant_id);
      const segmentOf = new Map<string, string | null>();
      if (tenantIds.length) {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id, segment').in('id', tenantIds);
        for (const t of tenants || []) segmentOf.set(t.id, t.segment ?? null);
      }

      for (const sub of activeSubs || []) {
        const tenantSegment = segmentOf.get(sub.tenant_id) ?? null;
        const oldTablePrice = effectivePrice(tenantSegment, tier, oldDefaults, oldOverrides);
        const newTablePrice = effectivePrice(tenantSegment, tier, newDefaults, newOverrides);
        if (oldTablePrice === newTablePrice) continue;
        const paying = Number(sub.monthly_price_brl);

        // Reajuste ainda não aplicado deste assinante: é a referência do novo
        // cálculo e será substituído (nada de empilhar avisos/cobranças).
        const { data: pending } = await supabaseAdmin
          .from('subscription_price_changes')
          .select('id, new_price_brl')
          .eq('tenant_id', sub.tenant_id)
          .is('applied_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        const reference = pending?.[0] ? Number(pending[0].new_price_brl) : paying;

        // Proporcional à tabela: mantém PIX/cupom; cortesia (R$ 0) fica fora.
        const newPrice = adjustSubscriptionPrice(reference, oldTablePrice, newTablePrice);
        if (newPrice == null) continue;

        const { error: cancelErr } = await supabaseAdmin
          .from('subscription_price_changes')
          .delete()
          .eq('tenant_id', sub.tenant_id)
          .is('applied_at', null);
        if (cancelErr) {
          logger.error('interno.plan_price_cancel_pending_failed', {
            tenantId: sub.tenant_id,
            message: cancelErr.message,
          });
          continue;
        }

        if (newPrice <= paying) {
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
            old_price_brl: paying,
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
          const oldLabel = paying.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newLabel = newPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const base = appBaseUrl();

          for (const to of recipients) {
            await sendEmail({
              to,
              subject: `Aviso de reajuste — seu plano Domu Tech vai mudar em ${expiresAt}`,
              text: `Olá!\n\nO plano ${getPlanDisplayName(tier)} vai passar de ${oldLabel} para ${newLabel}/mês a partir de ${expiresAt}. Isso dá o aviso prévio de ${NOTICE_DAYS} dias previsto nos nossos Termos de Uso. Se quiser cancelar antes disso, não haverá cobrança do novo valor.\n\nEquipe Domu Tech${contactFooterText()}`,
              html: brandedEmailHtml({
                heading: 'Aviso de reajuste no seu plano',
                bodyHtml: `<p style="margin:0 0 12px;">Olá!</p>
                  <p style="margin:0 0 12px;">O plano <strong>${escapeHtml(getPlanDisplayName(tier))}</strong> vai passar de <strong>${oldLabel}</strong> para <strong>${newLabel}/mês</strong> a partir de <strong>${expiresAt}</strong>.</p>
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
      segment: segment || 'padrão',
      prices: Object.fromEntries(rows.map((r) => [r.plan_tier, r.price_brl])),
      changedTiers,
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
