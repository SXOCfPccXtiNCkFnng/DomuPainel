'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LayoutDashboard,
  RefreshCw,
  Search,
  Stethoscope,
  Tag,
  XCircle,
} from 'lucide-react';
import type { PlatformOverview, SubscriptionStatus } from '@/lib/platformOverview';
import type { OpsAlert } from '@/lib/opsAlert';
import type { HealthCheck, HealthStatus } from '@/lib/platformHealth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import AssistantMonitor from '@/components/interno/AssistantMonitor';
import PlanPricingEditor from '@/components/interno/PlanPricingEditor';

type CouponRow = {
  code: string;
  percent_off: number | null;
  active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  description: string | null;
};

type HealthData = { checkedAt: string; summary: Record<HealthStatus, number>; checks: HealthCheck[] };
type Tab = 'overview' | 'health' | 'errors' | 'tenants' | 'assistant' | 'commercial';

function statusLabel(status: SubscriptionStatus) {
  switch (status) {
    case 'ACTIVE':
      return { text: 'Pagando', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'TRIAL':
      return { text: 'Trial', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'PENDING_PAYMENT':
      return { text: 'Aguardando pagamento', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'PAST_DUE':
      return { text: 'Em atraso', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'CANCELED':
      return { text: 'Cancelada', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { text: 'Sem assinatura', className: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function qualityLabel(rating: string) {
  switch (rating) {
    case 'GREEN':
      return { text: 'Boa', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'YELLOW':
      return { text: 'Atenção', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'RED':
      return { text: 'Crítica', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'ERROR':
      return { text: 'Erro ao consultar', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { text: 'Desconhecida', className: 'bg-slate-50 text-slate-500 border-slate-200' };
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return formatDate(iso);
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Nome legível da origem do erro (evento técnico → área do sistema). */
const SOURCE_LABELS: Record<string, string> = {
  'cron.run-due': 'Cron de campanhas',
  'cron.follow-up': 'Cron de follow-up',
  'cron.apply-price-changes': 'Reajuste de preço',
  'cron.expiry-check': 'Aviso de vencimento',
  'billing.webhook': 'Webhook Asaas',
  campanha: 'Campanha',
  'campanha.isolamento': 'Isolamento entre contas',
  'interno.plan_prices': 'Preço dos planos',
};
const SOURCE_PREFIXES: [string, string][] = [
  ['webhook.', 'Webhook WhatsApp'],
  ['followup.', 'Follow-up'],
  ['meta.', 'API da Meta'],
  ['onboarding.', 'Conexão com a Meta'],
  ['whatsapp.', 'Conexão WhatsApp'],
  ['email.', 'E-mail'],
  ['billing.', 'Cobrança'],
  ['auth.', 'Login/conta'],
  ['team.', 'Equipe'],
  ['media.', 'Upload de mídia'],
  ['send.', 'Envio avulso'],
  ['interno.', 'Painel interno'],
  ['notify.', 'Notificações'],
];

function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  const prefix = SOURCE_PREFIXES.find(([p]) => source.startsWith(p));
  return prefix ? prefix[1] : source;
}

function StatCard({
  label,
  value,
  hint,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'navy' | 'green' | 'amber' | 'red' | 'slate' | 'blue';
}) {
  const valueColor = {
    navy: 'text-white',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-slate-900',
    blue: 'text-domu-blue',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${tone === 'navy' ? 'bg-[#0B132B] border-[#1E293B]' : 'bg-white border-slate-200'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide ${tone === 'navy' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${valueColor}`}>{value}</p>
      {hint ? <p className={`mt-0.5 text-[11px] ${tone === 'navy' ? 'text-slate-400' : 'text-slate-400'}`}>{hint}</p> : null}
    </div>
  );
}

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const HEALTH_ICON: Record<HealthStatus, React.ReactNode> = {
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
  warn: <CircleAlert className="w-4 h-4 text-amber-500 shrink-0" />,
  fail: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
};

export default function InternoPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [alerts, setAlerts] = useState<OpsAlert[]>([]);
  const [alertStatus, setAlertStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [alertLevel, setAlertLevel] = useState<'all' | 'error' | 'warn'>('all');
  const [alertSource, setAlertSource] = useState('');
  const [alertTenant, setAlertTenant] = useState<{ id: string; name: string } | null>(null);
  const [alertSearch, setAlertSearch] = useState('');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponPercent, setCouponPercent] = useState('100');
  const [couponMax, setCouponMax] = useState('5');
  const [couponMsg, setCouponMsg] = useState('');
  const [grantBusy, setGrantBusy] = useState<string | null>(null);

  const loadOverview = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res = await fetch('/api/interno/overview', { cache: 'no-store' });
      if (res.status === 404 || res.status === 401) {
        setBlocked(true);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.overview) {
        setBlocked(true);
        return;
      }
      setOverview(json.overview);
    } catch {
      if (!opts?.silent) setError('Não foi possível carregar o painel.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/interno/health', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setHealth(json.health);
    } catch {
      /* mantém o último diagnóstico */
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    const params = new URLSearchParams({ status: alertStatus, level: alertLevel });
    if (alertSource) params.set('source', alertSource);
    if (alertTenant) params.set('tenantId', alertTenant.id);
    try {
      const res = await fetch(`/api/interno/alerts?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setAlerts(json.alerts || []);
    } catch {
      /* mantém a lista */
    }
  }, [alertStatus, alertLevel, alertSource, alertTenant]);

  const loadCommercial = useCallback(async () => {
    const couponsRes = await fetch('/api/interno/coupons', { cache: 'no-store' });
    if (couponsRes.ok) {
      const cjson = await couponsRes.json();
      if (cjson.success) setCoupons(cjson.coupons || []);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadHealth();
    loadCommercial();
  }, [loadOverview, loadHealth, loadCommercial]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Números e erros se atualizam sozinhos; o diagnóstico (consulta Meta/Google) a cada 5 min.
  useAutoRefresh(() => Promise.all([loadOverview({ silent: true }), loadAlerts()]), { intervalMs: 30_000 });
  useAutoRefresh(loadHealth, { intervalMs: 5 * 60_000 });

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponMsg('');
    const res = await fetch('/api/interno/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: couponCode,
        percentOff: Number(couponPercent),
        maxRedemptions: couponMax === '' ? null : Number(couponMax),
        description: Number(couponPercent) >= 100 ? 'Cortesia / teste' : undefined,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setCouponMsg(json.error || 'Não foi possível criar.');
      return;
    }
    setCouponMsg(`Cupom ${json.coupon.code} criado. A pessoa digita isso no checkout.`);
    setCouponCode('');
    loadCommercial();
  }

  async function toggleCoupon(code: string, active: boolean) {
    await fetch('/api/interno/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, active }),
    });
    loadCommercial();
  }

  async function grantAccess(tenantId: string) {
    setGrantBusy(tenantId);
    try {
      const res = await fetch('/api/interno/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planTier: 'STARTER' }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error || 'Falha ao liberar.');
      else await loadOverview({ silent: true });
    } finally {
      setGrantBusy(null);
    }
  }

  async function resolveAlert(id: string, resolved: boolean) {
    await fetch('/api/interno/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resolved }),
    });
    loadAlerts();
    loadOverview({ silent: true });
  }

  async function resolveSource(source: string) {
    await fetch('/api/interno/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    loadAlerts();
    loadOverview({ silent: true });
  }

  const openTenantErrors = (id: string, name: string) => {
    setAlertTenant({ id, name });
    setAlertStatus('all');
    setTab('errors');
  };

  const filteredAlerts = useMemo(() => {
    const q = alertSearch.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(
      (a) => a.message.toLowerCase().includes(q) || a.source.toLowerCase().includes(q) || (a.tenantName || '').toLowerCase().includes(q)
    );
  }, [alerts, alertSearch]);

  const alertSources = useMemo(() => [...new Set(alerts.map((a) => a.source))].sort(), [alerts]);

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    const list = overview?.tenants || [];
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q) || t.tenantId.startsWith(q));
  }, [overview?.tenants, tenantSearch]);

  if (blocked) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md max-w-md w-full space-y-4">
          <span className="text-4xl font-black text-domu-blue">404</span>
          <h2 className="text-lg font-black text-slate-900">Página Não Encontrada</h2>
          <p className="text-xs text-slate-500">A página que você está procurando não existe ou foi movida.</p>
          <Link href="/" className="inline-block btn-domu-primary text-xs py-2 px-4 shadow-sm">
            Voltar ao Inicio
          </Link>
        </div>
      </div>
    );
  }

  const t = overview?.totals;
  const healthFails = health?.summary.fail || 0;
  const healthWarns = health?.summary.warn || 0;
  const openErrors = overview?.errors.open || 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number; badgeTone?: string }[] = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'health', label: 'Saúde do sistema', icon: <Stethoscope className="w-4 h-4" />, badge: healthFails || healthWarns, badgeTone: healthFails ? 'bg-red-600' : 'bg-amber-500' },
    { id: 'errors', label: 'Erros', icon: <AlertTriangle className="w-4 h-4" />, badge: openErrors, badgeTone: 'bg-red-600' },
    { id: 'tenants', label: 'Empresas', icon: <Building2 className="w-4 h-4" /> },
    { id: 'assistant', label: 'Atendente IA', icon: <Bot className="w-4 h-4" /> },
    { id: 'commercial', label: 'Comercial', icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue">Operação Domu</p>
          <h1 className="text-2xl font-black text-slate-900">Painel interno</h1>
          <p className="text-xs text-slate-500 mt-1">
            {overview?.generatedAt ? `Atualizado ${formatRelativeTime(overview.generatedAt)} · atualiza sozinho` : 'Carregando…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health ? (
            <button
              type="button"
              onClick={() => setTab('health')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 border ${
                healthFails
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : healthWarns
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {healthFails ? `${healthFails} problema(s)` : healthWarns ? `${healthWarns} aviso(s)` : 'Sistema saudável'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              loadOverview();
              loadHealth();
              loadAlerts();
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-domu-blue/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || healthLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === item.id ? 'border-domu-blue text-domu-blue' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.icon}
            {item.label}
            {item.badge ? (
              <span className={`ml-0.5 min-w-[18px] text-center text-[10px] text-white rounded-full px-1.5 py-px ${item.badgeTone}`}>{item.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}
      {loading && !overview ? <p className="text-sm text-slate-500">Carregando números…</p> : null}

      {/* ───────── Visão geral ───────── */}
      {tab === 'overview' && overview && t ? (
        <div className="space-y-5">
          {healthFails > 0 ? (
            <button
              type="button"
              onClick={() => setTab('health')}
              className="w-full text-left rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3"
            >
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm text-red-800">
                <strong>{healthFails} problema(s) na saúde do sistema</strong> — {health?.checks.filter((c) => c.status === 'fail').map((c) => c.label).join(', ')}.
              </span>
              <ChevronRight className="w-4 h-4 text-red-400 ml-auto shrink-0" />
            </button>
          ) : null}

          {overview.cronHealth.overdueCount > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <strong>{overview.cronHealth.overdueCount} campanha(s) agendada(s) atrasada(s).</strong> Confira se o cron de
              <code className="font-mono mx-1">/api/campaigns/run-due</code>está ativo.
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-2">Negócio</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Empresas" value={t.tenants} hint={`${t.users} usuários · ${overview.growth.signups7d} novas em 7d`} tone="navy" />
              <StatCard label="Pagando" value={t.paying} hint={`${t.trial} em trial`} tone="green" />
              <StatCard label="MRR" value={brl(overview.mrr)} hint={t.paying ? `Ticket médio ${brl(overview.mrr / t.paying)}` : 'Receita recorrente'} tone="green" />
              <StatCard
                label="Precisam de atenção"
                value={t.pastDue + t.pendingPayment}
                hint={`${t.pastDue} em atraso · ${t.pendingPayment} aguardando pagamento`}
                tone={t.pastDue + t.pendingPayment > 0 ? 'amber' : 'slate'}
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-2">Uso nos últimos 7 dias</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Campanhas"
                value={overview.campaigns7d.total}
                hint={`${overview.delivery7d.sent.toLocaleString('pt-BR')} envios · ${overview.campaigns7d.failed} falharam`}
              />
              <StatCard
                label="Taxa de entrega"
                value={overview.delivery7d.deliveryRatePercent != null ? `${overview.delivery7d.deliveryRatePercent}%` : '—'}
                hint={overview.delivery7d.sent > 0 ? `${overview.delivery7d.delivered} de ${overview.delivery7d.sent}` : 'Sem envios'}
                tone={overview.delivery7d.deliveryRatePercent == null ? 'slate' : overview.delivery7d.deliveryRatePercent < 80 ? 'red' : 'green'}
              />
              <StatCard
                label="Mensagens recebidas"
                value={overview.messaging7d.received.toLocaleString('pt-BR')}
                hint={`${overview.messaging7d.newContactsFromWhatsapp} contatos novos pelo WhatsApp`}
                tone="blue"
              />
              <StatCard
                label="Follow-ups enviados"
                value={overview.followUp7d.sent}
                hint={
                  overview.followUp7d.sent
                    ? `${Math.round((overview.followUp7d.replied / overview.followUp7d.sent) * 100)}% responderam · ${overview.followUp7d.avoided} evitados`
                    : `${overview.followUp7d.avoided} evitados pelas proteções`
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Quem mais enviou (7 dias)" subtitle="Disparos de campanha por empresa.">
              {overview.topTenants7d.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Nenhum envio nos últimos 7 dias.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overview.topTenants7d.map((row) => (
                    <li key={row.tenantId} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-800">{row.name}</span>
                      <span className="text-slate-600 font-mono">{row.sent.toLocaleString('pt-BR')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Por que os envios falham (7 dias)" subtitle="Motivos que a Meta devolveu nas campanhas.">
              {overview.failureReasons7d.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Nenhuma falha de envio nos últimos 7 dias.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overview.failureReasons7d.map((row) => (
                    <li key={row.reason} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                      <span className="font-black text-red-600 shrink-0">{row.count}×</span>
                      <span className="text-slate-700">{row.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section
            title="Erros abertos mais recentes"
            subtitle={`${openErrors} aberto(s) · ${overview.errors.last24h} ocorrência(s) nas últimas 24h`}
            action={
              <button type="button" onClick={() => setTab('errors')} className="text-xs font-bold text-domu-blue">
                Ver todos →
              </button>
            }
          >
            {overview.alerts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nenhum erro aberto. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overview.alerts.slice(0, 5).map((a) => (
                  <li key={a.id} className="px-4 py-2.5 flex items-start gap-2 text-sm">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.level === 'warn' ? 'bg-amber-400' : 'bg-red-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="font-bold text-slate-800">{sourceLabel(a.source)}</span>
                      <span className="text-slate-600"> — {a.message}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {a.occurrences > 1 ? `${a.occurrences}× · ` : ''}
                      {formatRelativeTime(a.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              title="Qualidade das contas WhatsApp"
              subtitle="Nota da Meta para cada número. Fora do verde, o limite de disparo cai."
            >
              {overview.whatsappQuality.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Nenhuma conta conectada.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overview.whatsappQuality.map((w) => {
                    const badge = qualityLabel(w.qualityRating);
                    return (
                      <li key={w.tenantId} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{w.tenantName || w.tenantId.slice(0, 8)}</p>
                          <p className="text-[11px] text-slate-500">
                            {w.displayPhoneNumber || w.error || '—'}
                            {w.messagingLimitTier ? ` · limite ${w.messagingLimitTier.replace('TIER_', '')}` : ''}
                          </p>
                        </div>
                        <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${badge.className}`}>{badge.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
            <Section title="Vencendo em até 3 dias" subtitle="Vale um contato antes de virar atraso.">
              {overview.expiringSoon.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Nenhuma assinatura vencendo.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overview.expiringSoon.map((s) => (
                    <li key={s.tenantId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{s.tenantName || s.tenantId.slice(0, 8)}</p>
                        <p className="text-[11px] text-slate-500">{s.planTier || '—'}</p>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        {s.daysLeft === 0 ? 'vence hoje' : `${s.daysLeft} dia${s.daysLeft > 1 ? 's' : ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      ) : null}

      {/* ───────── Saúde do sistema ───────── */}
      {tab === 'health' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {health ? `Diagnóstico ${formatRelativeTime(health.checkedAt)} · ` : ''}
              Confere banco, configuração, integrações, crons e filas. Cada problema diz o que fazer.
            </p>
            <button
              type="button"
              onClick={loadHealth}
              disabled={healthLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-domu-blue border border-slate-200 bg-white rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
              Rodar diagnóstico
            </button>
          </div>
          {!health ? (
            <p className="text-sm text-slate-500">Rodando diagnóstico…</p>
          ) : (
            (['Banco de dados', 'Configuração', 'Integrações', 'Rotinas', 'Filas'] as const).map((group) => {
              const items = health.checks.filter((c) => c.group === group);
              if (items.length === 0) return null;
              const bad = items.filter((c) => c.status !== 'ok').length;
              return (
                <Section key={group} title={group} subtitle={bad ? `${bad} item(ns) com problema` : 'Tudo certo'}>
                  <ul className="divide-y divide-slate-100">
                    {items
                      .slice()
                      .sort((a, b) => ({ fail: 0, warn: 1, ok: 2 })[a.status] - ({ fail: 0, warn: 1, ok: 2 })[b.status])
                      .map((c) => (
                        <li key={c.id} className="px-4 py-3 flex items-start gap-3">
                          {HEALTH_ICON[c.status]}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{c.label}</p>
                            <p className={`text-xs mt-0.5 ${c.status === 'ok' ? 'text-slate-500' : 'text-slate-700'}`}>{c.detail}</p>
                            {c.fix ? (
                              <p className="text-xs mt-1 text-domu-blue">
                                <strong>Como resolver:</strong> {c.fix}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                  </ul>
                </Section>
              );
            })
          )}
        </div>
      ) : null}

      {/* ───────── Erros ───────── */}
      {tab === 'errors' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(
                [
                  ['open', 'Abertos'],
                  ['resolved', 'Resolvidos'],
                  ['all', 'Todos'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAlertStatus(id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${alertStatus === id ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(
                [
                  ['all', 'Erros e avisos'],
                  ['error', 'Só erros'],
                  ['warn', 'Só avisos'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAlertLevel(id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${alertLevel === id ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={alertSource}
              onChange={(e) => setAlertSource(e.target.value)}
              aria-label="Filtrar por origem"
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">Todas as origens</option>
              {alertSources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)} ({s})
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                placeholder="Buscar na mensagem, origem ou empresa"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {alertTenant || alertSource ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {alertTenant ? (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-domu-blue border border-blue-200 rounded-full px-2.5 py-1 font-bold">
                  Empresa: {alertTenant.name}
                  <button type="button" onClick={() => setAlertTenant(null)} aria-label="Remover filtro de empresa">
                    ×
                  </button>
                </span>
              ) : null}
              {alertSource && alertStatus !== 'resolved' ? (
                <button type="button" onClick={() => resolveSource(alertSource)} className="font-bold text-emerald-700 hover:underline">
                  Marcar todos de &quot;{sourceLabel(alertSource)}&quot; como resolvidos
                </button>
              ) : null}
            </div>
          ) : null}

          <Section
            title={`${filteredAlerts.length} ${alertStatus === 'resolved' ? 'resolvido(s)' : alertStatus === 'open' ? 'aberto(s)' : 'registro(s)'}`}
            subtitle="Erros iguais ficam agrupados numa linha só, com o número de ocorrências. Clique para ver os detalhes técnicos."
          >
            {filteredAlerts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">Nada por aqui com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredAlerts.map((a) => {
                  const open = expandedAlert === a.id;
                  return (
                    <li key={a.id} className={a.resolvedAt ? 'bg-slate-50/60' : ''}>
                      <button
                        type="button"
                        onClick={() => setExpandedAlert(open ? null : a.id)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3"
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                                a.level === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-100'
                              }`}
                            >
                              {a.level === 'warn' ? 'Aviso' : 'Erro'} · {sourceLabel(a.source)}
                            </span>
                            {a.occurrences > 1 ? (
                              <span className="text-[10px] font-black text-slate-700 bg-slate-100 rounded-full px-2 py-0.5">{a.occurrences}×</span>
                            ) : null}
                            {a.tenantName ? <span className="text-[11px] text-slate-500">{a.tenantName}</span> : null}
                            {a.resolvedAt ? <span className="text-[10px] font-bold text-emerald-700">Resolvido</span> : null}
                            <span className="text-[11px] text-slate-400 ml-auto" title={formatDate(a.lastSeenAt)}>
                              {formatRelativeTime(a.lastSeenAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 mt-1 break-words">{a.message}</p>
                        </div>
                      </button>
                      {open ? (
                        <div className="px-11 pb-4 space-y-2">
                          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <dt className="text-slate-400 font-bold uppercase">Primeira vez</dt>
                              <dd className="text-slate-700">{formatDate(a.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-slate-400 font-bold uppercase">Última vez</dt>
                              <dd className="text-slate-700">{formatDate(a.lastSeenAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-slate-400 font-bold uppercase">Evento técnico</dt>
                              <dd className="text-slate-700 font-mono">{a.source}</dd>
                            </div>
                          </dl>
                          {Object.keys(a.meta || {}).length > 0 ? (
                            <pre className="text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-64">
                              {JSON.stringify(a.meta, null, 2)}
                            </pre>
                          ) : null}
                          {a.resolvedAt ? (
                            <p className="text-[11px] text-slate-500">
                              Resolvido {formatDate(a.resolvedAt)}
                              {a.resolvedBy ? ` por ${a.resolvedBy}` : ''}.
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => resolveAlert(a.id, !a.resolvedAt)}
                              className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${
                                a.resolvedAt ? 'text-slate-700 border-slate-200 bg-white' : 'text-emerald-700 border-emerald-200 bg-emerald-50'
                              }`}
                            >
                              {a.resolvedAt ? 'Reabrir' : 'Marcar como resolvido'}
                            </button>
                            {a.tenantId && !alertTenant ? (
                              <button
                                type="button"
                                onClick={() => openTenantErrors(a.tenantId!, a.tenantName || a.tenantId!.slice(0, 8))}
                                className="text-xs font-bold text-domu-blue rounded-lg px-3 py-1.5 border border-slate-200 bg-white"
                              >
                                Ver erros desta empresa
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {/* ───────── Empresas ───────── */}
      {tab === 'tenants' && overview ? (
        <Section
          title={`Empresas (${overview.tenants.length})`}
          action={
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Buscar empresa"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-48"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-bold">Empresa</th>
                  <th className="px-4 py-2 font-bold">Assinatura</th>
                  <th className="px-4 py-2 font-bold">WhatsApp</th>
                  <th className="px-4 py-2 font-bold">Envios 7d</th>
                  <th className="px-4 py-2 font-bold">Última atividade</th>
                  <th className="px-4 py-2 font-bold">Cadastro</th>
                  <th className="px-4 py-2 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((row) => {
                  const badge = statusLabel(row.subscriptionStatus);
                  return (
                    <tr key={row.tenantId} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-slate-900">{row.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {row.segment} · <span className="font-mono">{row.tenantId.slice(0, 8)}</span>
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex text-[11px] font-bold border rounded-full px-2 py-0.5 ${badge.className}`}>{badge.text}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {row.planTier || '—'}
                          {row.monthlyPrice != null ? ` · ${row.monthlyPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {row.whatsappConnected ? (
                          <span className="text-emerald-700 font-bold">● Conectado</span>
                        ) : (
                          <span className="text-slate-400">Não conectado</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700">{row.sent7d.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{row.lastActivityAt ? formatRelativeTime(row.lastActivityAt) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-2.5 space-y-1">
                        <button type="button" onClick={() => openTenantErrors(row.tenantId, row.name)} className="block text-[11px] font-bold text-domu-blue">
                          Ver erros
                        </button>
                        {row.subscriptionStatus !== 'ACTIVE' && row.subscriptionStatus !== 'TRIAL' ? (
                          <button
                            type="button"
                            disabled={grantBusy === row.tenantId}
                            onClick={() => grantAccess(row.tenantId)}
                            className="block text-[11px] font-bold text-emerald-700 disabled:opacity-50"
                          >
                            {grantBusy === row.tenantId ? 'Liberando…' : 'Liberar 30 dias'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {/* ───────── Comercial ───────── */}
      {tab === 'assistant' ? <AssistantMonitor /> : null}

      {tab === 'commercial' ? (
        <div className="space-y-4">
          <PlanPricingEditor />

          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Cupons</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">100% libera o plano na hora, sem PIX. A pessoa cola o código no onboarding/assinatura.</p>
            </div>
            <form onSubmit={createCoupon} className="flex flex-wrap gap-2 items-end">
              <label className="text-xs font-bold text-slate-600">
                Código
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="EX: DOMUTESTE"
                  className="mt-1 block w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                % desconto
                <select
                  value={couponPercent}
                  onChange={(e) => setCouponPercent(e.target.value)}
                  className="mt-1 block w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="100">100% (grátis)</option>
                  <option value="50">50%</option>
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Usos máx.
                <input
                  value={couponMax}
                  onChange={(e) => setCouponMax(e.target.value)}
                  placeholder="ilimitado"
                  className="mt-1 block w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
              <button type="submit" className="btn-domu-primary text-xs py-2 px-4">
                Criar cupom
              </button>
            </form>
            {couponMsg ? <p className="text-xs text-slate-600">{couponMsg}</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-1">Código</th>
                    <th className="py-1">Desconto</th>
                    <th className="py-1">Usos</th>
                    <th className="py-1">Status</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.code} className="border-t border-slate-100">
                      <td className="py-2 font-mono font-bold">{c.code}</td>
                      <td className="py-2">{c.percent_off != null ? `${c.percent_off}%` : '—'}</td>
                      <td className="py-2 text-slate-600">
                        {c.redemption_count}
                        {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ''}
                      </td>
                      <td className="py-2">{c.active ? 'Ativo' : 'Inativo'}</td>
                      <td className="py-2">
                        <button type="button" onClick={() => toggleCoupon(c.code, !c.active)} className="text-[11px] font-bold text-domu-blue">
                          {c.active ? 'Desativar' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-500 text-sm">
                        Nenhum cupom ainda. Crie um de 100% para testes.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
