/**
 * Atendente de vendas da própria Domu. A conta em DOMU_SALES_TENANT_ID usa a
 * atendente de IA para vender a plataforma: o Alan aborda o estabelecimento
 * pelo WhatsApp (pelo celular ou pelo painel) e a IA continua a conversa.
 * Ela só responde quem foi abordado primeiro (a conversa começou do nosso lado).
 *
 * Avisos (venda, cliente quente, dúvida que a IA não sabe) vão para o
 * WhatsApp em DOMU_SALES_NOTIFY_PHONE, enviados pelo número da conta de vendas.
 */
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { logger } from '@/lib/logger';
import { notifyTenantAdmins } from '@/lib/notify';
import { formatMetaError, sendMetaTemplate, sendMetaText } from '@/lib/metaClient';
import { requireVerifiedWhatsApp } from '@/lib/whatsappConnection';
import { ensureUtilityTemplate } from '@/lib/utilityTemplate';
import { phoneLookupVariants, toStoredPhone } from '@/lib/phone';
import { formatPhoneBR } from '@/lib/validators';
import { findActiveCoupon, couponFreeDays } from '@/lib/billing';
import { getDefaultPlanPrices, getSegmentPriceOverrides, resolvePlanPrices, PLAN_TIERS } from '@/lib/planPricing';
import { planBlurb, planFeatures } from '@/lib/planFeatures';
import { getPlanDisplayName } from '@/lib/planLimits';
import { isPlatformAdminEmail } from '@/lib/platformAdmin';

export function salesTenantId(): string | null {
  const id = String(process.env.DOMU_SALES_TENANT_ID || '').trim();
  return id || null;
}

export function isSalesTenant(tenantId: string | null | undefined): boolean {
  const id = salesTenantId();
  return Boolean(id && tenantId && id === tenantId);
}

/** Número que recebe os avisos (55 + DDD + número) ou null se não parecer válido. */
export function normalizeNotifyPhone(raw: string | null | undefined): string | null {
  const stored = toStoredPhone(String(raw || ''));
  return /^55\d{10,11}$/.test(stored) ? stored : null;
}

export function salesNotifyPhone(): string | null {
  return normalizeNotifyPhone(process.env.DOMU_SALES_NOTIFY_PHONE);
}

// ───────── Conhecimento que muda (planos e cupom) ─────────

export type SalesCoupon = { code: string; freeDays: number; percentOff: number; amountOff: number };

/** Cupom que a IA pode oferecer (DOMU_SALES_COUPON), só se estiver ativo de verdade. */
export async function loadSalesCoupon(): Promise<SalesCoupon | null> {
  const code = String(process.env.DOMU_SALES_COUPON || '').trim();
  if (!code) return null;
  const found = await findActiveCoupon(code).catch(() => null);
  if (!found?.ok) {
    logger.warn('sales.coupon_unavailable', { message: found && !found.ok ? found.error : 'erro ao validar' });
    return null;
  }
  const c = found.coupon;
  return {
    code: c.code.toUpperCase(),
    freeDays: couponFreeDays(c),
    percentOff: Number(c.percent_off || 0),
    amountOff: Number(c.amount_off_brl || 0),
  };
}

export type SalesPlanGroup = {
  label: string;
  plans: { name: string; price: number; blurb: string; features: string[] }[];
};

/** Ramos que a Domu atende, com o segmento usado para preço e recursos. */
export const SALES_SEGMENTS: { segment: string; label: string }[] = [
  { segment: 'imobiliario', label: 'Imobiliárias, corretores e construtoras' },
  { segment: 'automotivo', label: 'Lava rápido e estética automotiva' },
  { segment: 'saude', label: 'Saúde e beleza (barbearia, salão, manicure, estética, clínicas, dentistas)' },
  { segment: 'geral', label: 'Outros negócios (restaurante, loja, escritório e outros): campanhas pelo WhatsApp oficial' },
];

/** Planos com o preço vigente (editável no /interno) e a mesma lista da tela de Assinatura. */
export async function loadSalesPlans(): Promise<SalesPlanGroup[]> {
  const [defaults, overrides] = await Promise.all([getDefaultPlanPrices(), getSegmentPriceOverrides()]);
  return SALES_SEGMENTS.map(({ segment, label }) => {
    const prices = resolvePlanPrices(defaults, overrides, { segment });
    return {
      label,
      plans: PLAN_TIERS.map((tier) => ({
        name: getPlanDisplayName(tier),
        price: prices[tier],
        blurb: planBlurb(segment, tier),
        features: planFeatures(segment, tier),
      })),
    };
  });
}

// ───────── Avisos para o Alan ─────────

export const SALES_ALERT_PREFIX = 'domu_aviso_vendas_';
export const SALES_ALERT_BODY = 'Novo aviso da Domu: {{aviso}}. Abra o WhatsApp ou o painel para acompanhar.';

/** Texto de variável de modelo: a Meta recusa quebra de linha, tab e espaços seguidos. */
export function alertParam(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 900);
}

async function sendAlertWhatsApp(text: string): Promise<void> {
  const tenantId = salesTenantId();
  const to = salesNotifyPhone();
  if (!tenantId || !to) {
    logger.warn('sales.alert_not_configured', { message: 'Defina DOMU_SALES_TENANT_ID e DOMU_SALES_NOTIFY_PHONE.' });
    return;
  }
  const wa = await requireVerifiedWhatsApp(tenantId);
  if (!wa.ok) {
    logger.warn('sales.alert_whatsapp_unavailable', { error: wa.error });
    return;
  }

  // Aviso pode chegar a qualquer hora: o modelo aprovado não depende da janela de 24h.
  const template = await ensureUtilityTemplate(tenantId, {
    prefix: SALES_ALERT_PREFIX,
    body: SALES_ALERT_BODY,
    variables: ['aviso'],
    label: 'de aviso de vendas',
    loadId: async () => {
      const { data } = await supabaseAdmin
        .from('hsm_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .like('name', `${SALES_ALERT_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0]?.id ?? null;
    },
    saveId: async () => {},
  }).catch((err) => ({ ok: false as const, reason: err instanceof Error ? err.message : String(err) }));

  const sent = template.ok
    ? await sendMetaTemplate({
        to,
        templateName: template.name,
        languageCode: template.language,
        credentials: wa.credentials,
        components: [{ type: 'body', parameters: [{ type: 'text', text: alertParam(text) }] }],
      })
    : // Modelo ainda em análise: texto livre chega se o Alan falou com o número nas últimas 24h.
      await sendMetaText({ to, textBody: `Aviso da Domu: ${text}`, credentials: wa.credentials });
  if (!sent.success) {
    logger.warn('sales.alert_send_failed', {
      template: template.ok ? template.name : null,
      reason: template.ok ? null : template.reason,
      error: formatMetaError(sent.error),
    });
  }
}

/** Avisa o Alan: WhatsApp no número dele + sino/celular do painel da conta de vendas. Nunca lança. */
export async function notifySalesOwner(input: { title: string; text: string }): Promise<void> {
  const tenantId = salesTenantId();
  try {
    await Promise.all([
      sendAlertWhatsApp(input.text),
      tenantId
        ? notifyTenantAdmins(tenantId, { title: input.title, message: input.text, type: 'SUCCESS', url: '/atendimento' })
        : Promise.resolve(),
    ]);
  } catch (err) {
    logger.warn('sales.alert_failed', { message: err instanceof Error ? err.message : String(err) });
  }
}

// ───────── Conta criada, teste grátis e pagamento ─────────

export type SalesEvent = 'SIGNUP' | 'TRIAL' | 'PAID';

/** Contato da conversa de vendas com esse telefone (se a pessoa veio da abordagem). */
async function salesLeadFor(phone: string | null | undefined): Promise<{ name: string | null } | null> {
  const tenantId = salesTenantId();
  const variants = phoneLookupVariants(String(phone || ''));
  if (!tenantId || !variants.length) return null;
  const { data } = await supabaseAdmin
    .from('leads')
    .select('name')
    .eq('tenant_id', tenantId)
    .in('phone', variants)
    .limit(1);
  return data?.[0] ? { name: data[0].name ?? null } : null;
}

export function salesEventText(
  kind: SalesEvent,
  p: { company: string; person: string | null; phone: string | null; plan?: string | null; price?: number | null; fromConversation: boolean }
): { title: string; text: string } {
  const who = [p.person, p.phone ? `WhatsApp ${p.phone}` : null].filter(Boolean).join(', ');
  const origin = p.fromConversation ? ' Veio da conversa com a atendente de vendas.' : '';
  const plan = p.plan ? ` ${p.plan}` : '';
  if (kind === 'SIGNUP') {
    return { title: 'Conta nova na Domu', text: `${p.company} criou uma conta${who ? ` (${who})` : ''}.${origin}` };
  }
  if (kind === 'TRIAL') {
    return { title: 'Teste grátis começou', text: `${p.company} começou o teste grátis do plano${plan}${who ? ` (${who})` : ''}.${origin}` };
  }
  const price = p.price ? ` por R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês` : '';
  return { title: 'Venda feita! 🎉', text: `${p.company} assinou o plano${plan}${price}${who ? ` (${who})` : ''}.${origin}` };
}

export async function notifySalesEvent(
  kind: SalesEvent,
  tenantId: string,
  extra?: { planTier?: string | null; price?: number | null }
): Promise<void> {
  if (!salesTenantId() || isSalesTenant(tenantId)) return;
  const [{ data: tenant }, { data: admins }] = await Promise.all([
    supabaseAdmin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('name, email, phone')
      .eq('tenant_id', tenantId)
      .eq('role', 'ADMIN')
      .order('created_at', { ascending: true })
      .limit(1),
  ]);
  const admin = admins?.[0];
  // Contas de teste da própria Domu não viram aviso de venda.
  if (!tenant || isPlatformAdminEmail(admin?.email)) return;

  const lead = await salesLeadFor(admin?.phone);
  const { title, text } = salesEventText(kind, {
    company: tenant.name || 'Uma empresa',
    person: admin?.name || null,
    phone: admin?.phone ? formatPhoneBR(admin.phone) || admin.phone : null,
    plan: extra?.planTier ? getPlanDisplayName(extra.planTier) : null,
    price: extra?.price ?? null,
    fromConversation: Boolean(lead),
  });
  await notifySalesOwner({ title, text });
}

/** Agenda o aviso para depois da resposta (cadastro e pagamento não esperam o WhatsApp). */
export function scheduleSalesEvent(
  kind: SalesEvent,
  tenantId: string,
  extra?: { planTier?: string | null; price?: number | null }
): void {
  if (!salesTenantId()) return;
  const run = () =>
    notifySalesEvent(kind, tenantId, extra).catch((err) =>
      logger.warn('sales.event_failed', { kind, message: err instanceof Error ? err.message : String(err) })
    );
  try {
    after(run);
  } catch {
    void run();
  }
}
