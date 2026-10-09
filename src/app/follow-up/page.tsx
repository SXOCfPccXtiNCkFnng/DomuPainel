'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  Megaphone,
  MessageSquareReply,
  MessagesSquare,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import WhatsAppPreview from '@/components/shared/WhatsAppPreview';
import Disclosure from '@/components/shared/Disclosure';
import { LEAD_STATUS_OPTIONS } from '@/lib/contactTags';
import {
  CAMPAIGN_DELAY_OPTIONS,
  CONVERSATION_DELAY_OPTIONS,
  DEFAULT_FOLLOW_UP_SETTINGS,
  FOLLOW_UP_MESSAGE_MAX,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_TOKENS,
  formatDelay,
  hasNameToken,
  parseFollowUpMessage,
  renderFollowUpText,
  SUGGESTED_CAMPAIGN_MESSAGE,
  SUGGESTED_CONVERSATION_MESSAGE,
  type FollowUpSettings,
  type FollowUpStatus,
} from '@/lib/followUpRules';

type MessageStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
type Origin = 'CONVERSATION' | 'CAMPAIGN';
type StatsKey = 'all' | Origin;

type OriginStats = { sent: number; recovered: number; pending: number; repliedBefore: number; avoided: number; failed: number };

type RecentRow = {
  id: string;
  lead_id: string;
  status: FollowUpStatus;
  origin: Origin;
  due_at: string;
  sent_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  leads: { name?: string | null; phone?: string | null; follow_up_paused?: boolean | null } | null;
};

const EMPTY: OriginStats = { sent: 0, recovered: 0, pending: 0, repliedBefore: 0, avoided: 0, failed: 0 };
const PERIODS = [7, 30, 90];
const SAMPLE_CONTACT = 'Carlos Silva';
const HOURS = Array.from({ length: 25 }, (_, h) => h);

/** O que a checagem de contexto barra — mostrado para o cliente confiar na automação. */
const CONTEXT_PROTECTIONS = [
  'Despedida ("obrigado, até mais")',
  'Negócio fechado ou pago',
  'Visita/reunião já combinada',
  'Contato disse que vai retornar',
  'Você ficou de responder ou enviar algo',
  'Sem interesse ou pediu para parar',
  'Reclamação ou contato irritado',
  'Dúvida já resolvida',
  'Assunto delicado',
  'Mensagem não combina com a conversa',
];

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors disabled:bg-slate-50 disabled:text-slate-500';

const STATUS_STYLES: Record<FollowUpStatus, string> = {
  PENDING: 'bg-blue-50 text-domu-blue border-blue-200',
  PROCESSING: 'bg-blue-50 text-domu-blue border-blue-200',
  SENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REPLIED: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-500 border-slate-200',
  SKIPPED: 'bg-violet-50 text-violet-700 border-violet-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

const MESSAGE_STATUS: Record<MessageStatus, { label: string; className: string }> = {
  NONE: { label: 'Ainda não salva', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  PENDING: { label: 'Em análise na Meta', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Aprovada pela Meta', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Reprovada pela Meta', className: 'bg-red-50 text-red-700 border-red-200' },
};

function formatHour(h: number): string {
  return h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPhone(phone?: string | null): string {
  const d = (phone || '').replace(/\D/g, '');
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone || '';
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Card({
  icon,
  title,
  description,
  aside,
  muted,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-blue-50 text-domu-blue flex items-center justify-center shrink-0">{icon}</span>
          <div>
            <h2 className="text-sm font-black text-slate-900">{title}</h2>
            {description ? <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</div> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className={muted ? 'opacity-60' : ''}>{children}</div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
  tone = 'text-slate-900',
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200/80'}`}>
      <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
      <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">{caption}</p>
    </div>
  );
}

function MessageEditor({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  error,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  placeholder: string;
  error: string | null;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="space-y-2">
      <textarea
        id={id}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        maxLength={FOLLOW_UP_MESSAGE_MAX}
        placeholder={placeholder}
        className={`${inputClass} resize-y leading-relaxed`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_UP_TOKENS.map((t) => (
            <button
              key={t.token}
              type="button"
              disabled={disabled}
              onClick={() => insert(t.token)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-domu-blue hover:bg-blue-50 disabled:opacity-50"
            >
              + {t.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400">
          {value.length}/{FOLLOW_UP_MESSAGE_MAX}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Para a mensagem chegar com o nome da pessoa, inclua <strong className="font-mono text-slate-700">{'{{nome}}'}</strong>{' '}
        onde o nome deve aparecer (use o botão &quot;+ Nome do contato&quot;). Ex.: &quot;Oi {'{{nome}}'}, tudo bem?&quot; chega
        como &quot;Oi Carlos, tudo bem?&quot;.
      </p>
      {error ? (
        <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          {error}
        </p>
      ) : value.trim() && !hasNameToken(value) ? (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          Sua mensagem está sem {'{{nome}}'}, então vai chegar sem o nome do contato. Mensagens com o nome costumam ter mais
          resposta.
        </p>
      ) : null}
    </div>
  );
}

export default function FollowUpPage() {
  const [form, setForm] = useState<FollowUpSettings>(DEFAULT_FOLLOW_UP_SETTINGS);
  const [saved, setSaved] = useState<FollowUpSettings>(DEFAULT_FOLLOW_UP_SETTINGS);
  const [campaignStatus, setCampaignStatus] = useState<MessageStatus>('NONE');
  const [aiAvailable, setAiAvailable] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [days, setDays] = useState(30);
  const [statsView, setStatsView] = useState<StatsKey>('all');
  const [stats, setStats] = useState<Record<StatsKey, OriginStats>>({ all: EMPTY, CONVERSATION: EMPTY, CAMPAIGN: EMPTY });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [preview, setPreview] = useState<Origin>('CONVERSATION');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sem mensagem salva ainda: já vem uma sugestão pronta para o cliente só ajustar.
  const applySettings = (settings: FollowUpSettings) => {
    const withSuggestions = {
      ...settings,
      conversation_message: settings.conversation_message || SUGGESTED_CONVERSATION_MESSAGE,
      campaign_message: settings.campaign_message || SUGGESTED_CAMPAIGN_MESSAGE,
    };
    setForm(withSuggestions);
    setSaved(withSuggestions);
  };

  const load = useCallback(async (period: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/follow-up?days=${period}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar o follow-up.');
        return;
      }
      applySettings(json.settings);
      setCampaignStatus(json.campaignMessageStatus || 'NONE');
      setAiAvailable(Boolean(json.aiAvailable));
      setCompanyName(json.companyName || '');
      setStats(json.stats);
      setRecent(json.recent || []);
      setCanEdit(Boolean(json.canEdit));
      setError(null);
    } catch {
      setError('Não foi possível carregar o follow-up.');
    } finally {
      setIsLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const update = (patch: Partial<FollowUpSettings>) => {
    setForm((f) => ({ ...f, ...patch }));
    setNotice(null);
  };

  const conversationCheck = useMemo(
    () => (form.conversation_message.trim() ? parseFollowUpMessage(form.conversation_message, { forTemplate: false }) : null),
    [form.conversation_message]
  );
  const campaignCheck = useMemo(
    () => (form.campaign_message.trim() ? parseFollowUpMessage(form.campaign_message, { forTemplate: true }) : null),
    [form.campaign_message]
  );
  const campaignChanged = form.campaign_message.trim() !== saved.campaign_message.trim();
  const hasErrors = (conversationCheck && !conversationCheck.ok) || (campaignCheck && !campaignCheck.ok);

  const previewText = useMemo(() => {
    const text = (preview === 'CONVERSATION' ? form.conversation_message : form.campaign_message).trim();
    if (!text) return 'Escreva a mensagem ao lado para ver como ela chega no WhatsApp do contato.';
    return renderFollowUpText(text, { contactName: SAMPLE_CONTACT, companyName: companyName || 'Sua empresa' });
  }, [preview, form.conversation_message, form.campaign_message, companyName]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar.');
        return;
      }
      applySettings(json.settings);
      setCampaignStatus(json.campaignMessageStatus || 'NONE');
      setNotice(
        json.campaignMessageStatus === 'PENDING' && campaignChanged
          ? 'Salvo! A mensagem de campanha foi enviada para aprovação da Meta — costuma levar alguns minutos.'
          : 'Configuração salva.'
      );
      load(days);
    } catch {
      setError('Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelFollowUp = async (id: string) => {
    const res = await fetch(`/api/follow-up?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!json.success) setError(json.error || 'Não foi possível cancelar.');
    load(days);
  };

  const setPaused = async (leadId: string, paused: boolean) => {
    const res = await fetch('/api/follow-up', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, paused }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.success) setError(json.error || 'Não foi possível alterar o contato.');
    else setNotice(paused ? 'Contato pausado: ele não recebe mais follow-up.' : 'Follow-up retomado para o contato.');
    load(days);
  };

  const toggleStatus = (value: string) => {
    const set = new Set(form.excluded_statuses);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    update({ excluded_statuses: [...set] });
  };

  const disabled = !canEdit || isSaving;
  const s = stats[statsView] || EMPTY;
  const responseRate = s.sent > 0 ? Math.round((s.recovered / s.sent) * 100) : null;
  const anyOn = saved.conversation_enabled || saved.campaign_enabled;

  if (!loadedOnce) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Automação
            </span>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${anyOn ? 'text-emerald-600' : 'text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${anyOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {anyOn ? 'Ligado' : 'Desligado'}
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">Follow-up Automático</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quem parar de responder recebe uma nova mensagem sua — só quando faz sentido na conversa.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-bold">
          <span className={`px-2.5 py-1 rounded-lg border ${saved.conversation_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            Conversas: {saved.conversation_enabled ? 'ligado' : 'desligado'}
          </span>
          <span className={`px-2.5 py-1 rounded-lg border ${saved.campaign_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            Campanhas: {saved.campaign_enabled ? 'ligado' : 'desligado'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {/* Resultados */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-900">Resultados do follow-up</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1" role="group" aria-label="Tipo">
              {(
                [
                  ['all', 'Tudo'],
                  ['CONVERSATION', 'Conversas'],
                  ['CAMPAIGN', 'Campanhas'],
                ] as [StatsKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatsView(key)}
                  aria-pressed={statsView === key}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    statsView === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  aria-pressed={days === p}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    days === p ? 'bg-domu-blue text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={`grid grid-cols-2 lg:grid-cols-5 gap-3 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <MetricCard
            icon={<Send className="w-3.5 h-3.5" />}
            label="Enviados"
            value={s.sent.toLocaleString('pt-BR')}
            caption="Follow-ups que saíram para contatos que pararam de responder."
          />
          <MetricCard
            icon={<MessageSquareReply className="w-3.5 h-3.5" />}
            label="Responderam"
            value={responseRate == null ? '—' : `${responseRate}%`}
            caption={`${s.recovered.toLocaleString('pt-BR')} contato(s) voltaram a responder depois do follow-up.`}
            tone="text-emerald-600"
            highlight
          />
          <MetricCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Aguardando"
            value={s.pending.toLocaleString('pt-BR')}
            caption="Ainda no prazo de espera. Se responderem, nada é enviado."
            tone="text-domu-blue"
          />
          <MetricCard
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Nem precisou"
            value={s.repliedBefore.toLocaleString('pt-BR')}
            caption="Responderam antes do prazo, então o follow-up foi cancelado."
          />
          <MetricCard
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            label="Evitados"
            value={s.avoided.toLocaleString('pt-BR')}
            caption="Barrados pelas proteções (conversa encerrada, negócio fechado...). Veja o motivo na lista."
            tone="text-violet-700"
          />
        </div>
        {s.failed > 0 ? (
          <p className="text-[11px] text-red-600">{s.failed} follow-up(s) falharam no envio — o motivo está na lista abaixo.</p>
        ) : null}
      </section>

      {/* Configuração */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          <Card
            icon={<MessagesSquare className="w-4 h-4" />}
            title="Follow-up de conversa"
            description="Para quem conversou com você e parou de responder. Vale para mensagens enviadas pelo celular ou pelo painel. Sai sempre antes de a conversa do WhatsApp fechar (24h) — sem aprovação da Meta."
            aside={
              <Toggle
                checked={form.conversation_enabled}
                onChange={() => update({ conversation_enabled: !form.conversation_enabled })}
                disabled={disabled}
                label="Ligar follow-up de conversa"
              />
            }
            muted={!form.conversation_enabled}
          >
            <div className="space-y-3">
              <MessageEditor
                id="fu-conversation"
                value={form.conversation_message}
                onChange={(v) => update({ conversation_message: v })}
                disabled={disabled}
                placeholder="Ex.: Oi {{nome}}, tudo bem? Conseguiu ver minha última mensagem? Fico à disposição se tiver alguma dúvida."
                error={conversationCheck && !conversationCheck.ok ? conversationCheck.error : null}
              />
              <div className="max-w-xs">
                <label htmlFor="fu-conv-delay" className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Enviar se não responder em
                </label>
                <select
                  id="fu-conv-delay"
                  value={form.conversation_delay_hours}
                  disabled={disabled}
                  onChange={(e) => update({ conversation_delay_hours: Number(e.target.value) })}
                  className={inputClass}
                >
                  {CONVERSATION_DELAY_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {formatDelay(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card
            icon={<Megaphone className="w-4 h-4" />}
            title="Follow-up de campanha (opcional)"
            description="Para quem recebeu uma campanha e nunca respondeu. Como essa pessoa ainda não abriu conversa, o WhatsApp exige que a Meta aprove a mensagem — enviamos para aprovação automaticamente ao salvar."
            aside={
              <Toggle
                checked={form.campaign_enabled}
                onChange={() => update({ campaign_enabled: !form.campaign_enabled })}
                disabled={disabled}
                label="Ligar follow-up de campanha"
              />
            }
            muted={!form.campaign_enabled}
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${MESSAGE_STATUS[campaignStatus].className}`}>
                  {MESSAGE_STATUS[campaignStatus].label}
                </span>
              </div>
              <MessageEditor
                id="fu-campaign"
                value={form.campaign_message}
                onChange={(v) => update({ campaign_message: v })}
                disabled={disabled}
                placeholder="Ex.: Oi {{nome}}, aqui é da {{empresa}}. Vi que você recebeu nossa mensagem — posso te ajudar com alguma dúvida?"
                error={campaignCheck && !campaignCheck.ok ? campaignCheck.error : null}
              />
              {campaignStatus === 'REJECTED' && saved.template_note && !campaignChanged ? (
                <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{saved.template_note}</p>
              ) : null}
              <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                <Hourglass className="w-3.5 h-3.5 shrink-0 mt-px" />
                {campaignChanged && saved.campaign_message
                  ? 'Ao salvar, a nova mensagem vai para aprovação. Até ser aprovada, os follow-ups de campanha ficam aguardando.'
                  : 'A aprovação é feita uma vez só — depois a mesma mensagem é usada em todos os follow-ups de campanha.'}
              </p>
              <div className="max-w-xs">
                <label htmlFor="fu-camp-delay" className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Enviar se não responder em
                </label>
                <select
                  id="fu-camp-delay"
                  value={form.campaign_delay_hours}
                  disabled={disabled}
                  onChange={(e) => update({ campaign_delay_hours: Number(e.target.value) })}
                  className={inputClass}
                >
                  {CAMPAIGN_DELAY_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {formatDelay(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Proteções"
            description="Garantem que o follow-up só sai quando faz sentido. Na dúvida, ele não é enviado."
          >
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-violet-200 bg-violet-50/50 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    Checagem de contexto com IA
                  </p>
                  <Toggle
                    checked={form.ai_check_enabled}
                    onChange={() => update({ ai_check_enabled: !form.ai_check_enabled })}
                    disabled={disabled}
                    label="Checagem de contexto com IA"
                  />
                </div>
                <p className="text-[11px] text-slate-600">
                  Antes de cada follow-up de conversa, a IA lê as últimas mensagens e só envia se a conversa estiver
                  mesmo esperando resposta.
                </p>
                {!aiAvailable ? (
                  <p className="text-[11px] text-amber-700">
                    A IA não está configurada no servidor (GEMINI_API_KEY). Por segurança, com ela ligada os follow-ups de
                    conversa ficam aguardando em vez de sair sem checagem.
                  </p>
                ) : null}
              </div>

              <Disclosure title="O que as proteções verificam" subtitle="Situações em que o follow-up não é enviado">
                <div className="space-y-3 pt-2">
                  <div>
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5">A IA barra quando percebe</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CONTEXT_PROTECTIONS.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 text-[10.5px] text-slate-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5">Sempre ativas</p>
                    <ul className="text-[11px] text-slate-600 space-y-1">
                      <li>• Se o contato responder, o follow-up é cancelado.</li>
                      <li>• Se a última mensagem da conversa for do contato, nada é enviado (é a sua vez de responder).</li>
                      <li>• Quem pediu para não receber mensagens (opt-out) ou foi pausado não recebe.</li>
                    </ul>
                  </div>
                </div>
              </Disclosure>

              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-1.5">Não enviar para contatos com status</p>
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_STATUS_OPTIONS.map((opt) => {
                    const on = form.excluded_statuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleStatus(opt.value)}
                        aria-pressed={on}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-50 ${
                          on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fu-start" className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Enviar a partir de
                  </label>
                  <select
                    id="fu-start"
                    value={form.window_start_hour}
                    disabled={disabled}
                    onChange={(e) => update({ window_start_hour: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {HOURS.slice(0, 24).map((h) => (
                      <option key={h} value={h}>
                        {formatHour(h)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fu-end" className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Até
                  </label>
                  <select
                    id="fu-end"
                    value={form.window_end_hour}
                    disabled={disabled}
                    onChange={(e) => update({ window_end_hour: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {HOURS.slice(1).map((h) => (
                      <option key={h} value={h}>
                        {formatHour(h)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.skip_weekends}
                  disabled={disabled}
                  onChange={(e) => update({ skip_weekends: e.target.checked })}
                  className="w-4 h-4 accent-domu-blue"
                />
                Não enviar no sábado e no domingo
              </label>
              <p className="text-[11px] text-slate-500">
                Horário de Brasília. Fora do horário, a mensagem espera o próximo horário permitido — na conversa, só se
                ainda der tempo antes de ela fechar.
              </p>
            </div>
          </Card>

          {canEdit ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {dirty ? <span className="text-[11px] text-amber-700 font-semibold">Alterações não salvas</span> : null}
              <button
                type="button"
                onClick={save}
                disabled={isSaving || !dirty || Boolean(hasErrors)}
                className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar alterações
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 text-right">Só administradores da conta podem alterar o follow-up.</p>
          )}
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit" role="group" aria-label="Pré-visualizar">
            {(
              [
                ['CONVERSATION', 'Conversa'],
                ['CAMPAIGN', 'Campanha'],
              ] as [Origin, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreview(key)}
                aria-pressed={preview === key}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold ${
                  preview === key ? 'bg-domu-blue text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5">
            <WhatsAppPreview
              bodyText={previewText}
              contactName={companyName || 'Sua empresa'}
              companyLabel="Atendimento Oficial"
              footer={
                <p className="text-[11px] text-slate-600">
                  Sai{' '}
                  {formatDelay(preview === 'CONVERSATION' ? form.conversation_delay_hours : form.campaign_delay_hours)} depois,
                  sem resposta · {formatHour(form.window_start_hour)}–{formatHour(form.window_end_hour)}
                  {form.skip_weekends ? ' · seg a sex' : ''}
                </p>
              }
            />
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Exemplo com o contato &quot;{SAMPLE_CONTACT}&quot; — usamos só o primeiro nome.
            </p>
          </div>
        </div>
      </div>

      {/* Fila */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-domu-blue" />
            Últimos follow-ups
          </h2>
          <button
            type="button"
            onClick={() => load(days)}
            className="px-3 py-2 text-xs font-bold text-domu-blue hover:bg-blue-50 rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">
            Nenhum follow-up ainda. Assim que você ligar e conversar com seus contatos, eles aparecem aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left font-bold px-4 py-2.5">Contato</th>
                  <th className="text-left font-bold px-4 py-2.5">Situação</th>
                  <th className="text-left font-bold px-4 py-2.5">Tipo</th>
                  <th className="text-left font-bold px-4 py-2.5">Quando</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((row) => {
                  const paused = Boolean(row.leads?.follow_up_paused);
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 flex items-center gap-1.5">
                          {row.leads?.name || 'Contato'}
                          {paused ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-500 uppercase">Pausado</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-slate-500">{formatPhone(row.leads?.phone)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLES[row.status]}`}>
                          {FOLLOW_UP_STATUS_LABELS[row.status]}
                        </span>
                        {row.status === 'SENT' && row.replied_at ? (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-1">Respondeu depois ✓</p>
                        ) : null}
                        {row.error_message && row.status !== 'SENT' ? (
                          <p className="text-[10px] text-slate-500 mt-1 max-w-xs">{row.error_message}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.origin === 'CAMPAIGN' ? 'Campanha' : 'Conversa'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {row.status === 'PENDING' ? `Sai em ${formatDateTime(row.due_at)}` : formatDateTime(row.sent_at || row.due_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                        {row.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => cancelFollowUp(row.id)}
                            className="text-[11px] font-bold text-slate-500 hover:text-red-600 inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setPaused(row.lead_id, !paused)}
                          className="text-[11px] font-bold text-slate-500 hover:text-domu-blue inline-flex items-center gap-1"
                          title={paused ? 'Voltar a enviar follow-up para este contato' : 'Nunca mais enviar follow-up para este contato'}
                        >
                          {paused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                          {paused ? 'Retomar contato' : 'Pausar contato'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
