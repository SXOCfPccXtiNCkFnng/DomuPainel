/**
 * Funil de cadastro e clientes em risco (painel /interno). As regras ficam
 * aqui, puras; o carregamento do banco está em platformInsightsServer.ts.
 */
import { paymentStateOf, type PaymentState } from '@/lib/platformUsers';
import type { SubscriptionStatus } from '@/lib/platformOverview';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Pagante sem nenhum uso há esse tempo entra na lista de risco. */
export const RISK_INACTIVE_DAYS = 14;
const SEVERE_INACTIVE_DAYS = 30;
const RENEWAL_WARNING_DAYS = 5;

export type TenantContact = { name: string; email: string; phone: string };

/** Tudo que se sabe de uma empresa para o funil e o risco. */
export type TenantFacts = {
  tenantId: string;
  name: string;
  segment: string;
  createdAt: string;
  whatsappConnected: boolean;
  subscriptionStatus: SubscriptionStatus;
  monthlyPrice: number | null;
  planTier: string | null;
  periodEnd: string | null;
  firstSentAt: string | null;
  lastCampaignAt: string | null;
  lastLoginAt: string | null;
  lastAppointmentAt: string | null;
  contact: TenantContact | null;
};

export type FunnelStageId = 'signup' | 'connected' | 'activated' | 'first_campaign' | 'active_7d';

export type FunnelTenant = Pick<TenantFacts, 'tenantId' | 'name' | 'segment' | 'createdAt' | 'contact'> & {
  paymentState: PaymentState;
};

export type FunnelStage = {
  id: FunnelStageId;
  label: string;
  hint: string;
  count: number;
  /** % de quem se cadastrou. */
  percentOfTotal: number;
  /** % de quem chegou na etapa anterior. */
  percentOfPrevious: number;
  /** Chegaram na etapa anterior e pararam antes desta. */
  stuck: FunnelTenant[];
};

export type RiskReason = { code: string; text: string };

export type AtRiskTenant = {
  tenantId: string;
  name: string;
  segment: string;
  planTier: string | null;
  monthlyPrice: number;
  paymentState: PaymentState;
  severity: 'high' | 'medium';
  daysInactive: number | null;
  lastActivityAt: string | null;
  lastLoginAt: string | null;
  lastCampaignAt: string | null;
  periodEnd: string | null;
  reasons: RiskReason[];
  contact: TenantContact | null;
};

const ACTIVATED: SubscriptionStatus[] = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED'];

function latest(...dates: (string | null)[]): string | null {
  const times = dates.filter(Boolean).map((d) => new Date(d!).getTime());
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

export function lastActivityOf(f: TenantFacts): string | null {
  return latest(f.lastLoginAt, f.lastCampaignAt, f.lastAppointmentAt);
}

function daysSince(iso: string | null, now: number): number | null {
  return iso ? Math.floor((now - new Date(iso).getTime()) / DAY_MS) : null;
}

const STAGES: { id: FunnelStageId; label: string; hint: string; reached: (f: TenantFacts, now: number) => boolean }[] = [
  { id: 'signup', label: 'Cadastrou', hint: 'Criou a conta', reached: () => true },
  { id: 'connected', label: 'Conectou o WhatsApp', hint: 'Ligou o número na Meta', reached: (f) => f.whatsappConnected },
  {
    id: 'activated',
    label: 'Ativou um plano',
    hint: 'Pagou, ganhou cortesia ou trial',
    reached: (f) => ACTIVATED.includes(f.subscriptionStatus),
  },
  { id: 'first_campaign', label: 'Primeira campanha', hint: 'Enviou pelo menos um disparo', reached: (f) => Boolean(f.firstSentAt) },
  {
    id: 'active_7d',
    label: 'Usando agora',
    hint: 'Entrou, disparou ou agendou nos últimos 7 dias',
    reached: (f, now) => {
      const d = daysSince(lastActivityOf(f), now);
      return d != null && d <= 7;
    },
  },
];

/**
 * Funil acumulado: cada etapa só conta quem passou também pelas anteriores
 * (sem isso os números poderiam subir de uma etapa para a outra).
 */
export function buildFunnel(facts: TenantFacts[], opts: { sinceDays?: number | null; now?: number } = {}): FunnelStage[] {
  const now = opts.now ?? Date.now();
  const cohort = opts.sinceDays
    ? facts.filter((f) => now - new Date(f.createdAt).getTime() <= opts.sinceDays! * DAY_MS)
    : facts;
  const total = cohort.length;

  let previous = cohort;
  return STAGES.map((stage, i) => {
    const reached = previous.filter((f) => stage.reached(f, now));
    const stuck = i === 0 ? [] : previous.filter((f) => !stage.reached(f, now));
    const result: FunnelStage = {
      id: stage.id,
      label: stage.label,
      hint: stage.hint,
      count: reached.length,
      percentOfTotal: total ? Math.round((reached.length / total) * 100) : 0,
      percentOfPrevious: previous.length ? Math.round((reached.length / previous.length) * 100) : 0,
      stuck: stuck
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((f) => ({
          tenantId: f.tenantId,
          name: f.name,
          segment: f.segment,
          createdAt: f.createdAt,
          contact: f.contact,
          paymentState: paymentStateOf(f.subscriptionStatus, f.monthlyPrice),
        })),
    };
    previous = reached;
    return result;
  });
}

/** Quem paga (ou pagava e atrasou) e está dando sinais de que vai cancelar. */
export function findAtRiskTenants(facts: TenantFacts[], now = Date.now()): AtRiskTenant[] {
  const list: AtRiskTenant[] = [];

  for (const f of facts) {
    const paymentState = paymentStateOf(f.subscriptionStatus, f.monthlyPrice);
    if (paymentState !== 'PAYING' && paymentState !== 'PAST_DUE') continue;

    const lastActivityAt = lastActivityOf(f);
    const inactive = daysSince(lastActivityAt, now);
    const loginDays = daysSince(f.lastLoginAt, now);
    const campaignDays = daysSince(f.lastCampaignAt, now);
    const renewalDays = f.periodEnd ? Math.ceil((new Date(f.periodEnd).getTime() - now) / DAY_MS) : null;
    const reasons: RiskReason[] = [];

    if (paymentState === 'PAST_DUE') reasons.push({ code: 'past_due', text: 'Pagamento em atraso' });
    if (!f.whatsappConnected) reasons.push({ code: 'not_connected', text: 'Paga, mas o WhatsApp não está conectado' });
    if (inactive == null) {
      reasons.push({ code: 'never_used', text: 'Nunca usou o painel' });
    } else if (inactive >= RISK_INACTIVE_DAYS) {
      reasons.push({ code: 'inactive', text: `Nenhum uso há ${inactive} dias` });
    }
    if (f.lastCampaignAt == null) {
      if (f.firstSentAt == null) reasons.push({ code: 'no_campaign', text: 'Nunca enviou campanha' });
    } else if (campaignDays! >= RISK_INACTIVE_DAYS && (inactive == null || inactive < RISK_INACTIVE_DAYS)) {
      reasons.push({ code: 'campaigns_stopped', text: `Entra, mas não dispara há ${campaignDays} dias` });
    }

    // Só os sinais acima colocam na lista; o vencimento próximo apenas agrava.
    if (!reasons.length) continue;
    if (renewalDays != null && renewalDays >= 0 && renewalDays <= RENEWAL_WARNING_DAYS) {
      reasons.push({ code: 'renewal_soon', text: renewalDays === 0 ? 'Renova hoje' : `Renova em ${renewalDays} dia(s)` });
    }

    const severe =
      paymentState === 'PAST_DUE' ||
      inactive == null ||
      inactive >= SEVERE_INACTIVE_DAYS ||
      (loginDays == null && f.firstSentAt == null);

    list.push({
      tenantId: f.tenantId,
      name: f.name,
      segment: f.segment,
      planTier: f.planTier,
      monthlyPrice: f.monthlyPrice ?? 0,
      paymentState,
      severity: severe ? 'high' : 'medium',
      daysInactive: inactive,
      lastActivityAt,
      lastLoginAt: f.lastLoginAt,
      lastCampaignAt: f.lastCampaignAt,
      periodEnd: f.periodEnd,
      reasons,
      contact: f.contact,
    });
  }

  // Mais grave primeiro; entre iguais, quem vale mais.
  return list.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1) ||
      b.monthlyPrice - a.monthlyPrice ||
      (b.daysInactive ?? 99_999) - (a.daysInactive ?? 99_999)
  );
}
