'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Star,
  StickyNote,
  X,
} from 'lucide-react';
import type { TenantSegment } from '@/types';
import {
  DEFAULT_CITIES,
  DEFAULT_TEMPLATES,
  PROSPECT_KINDS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  REGION_CITIES,
  SEARCH_REUSE_DAYS,
  fillTemplate,
  prospectKind,
  whatsappNumber,
  type ProspectStatus,
} from '@/lib/prospectRules';
import { SEGMENT_LABELS } from '@/lib/segmentConfig';
import { formatPhone } from './contactFormat';

type Prospect = {
  id: string;
  name: string;
  kind: string;
  module: TenantSegment;
  city: string | null;
  address: string | null;
  phone: string | null;
  phone_intl: string | null;
  is_mobile: boolean;
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  rating: number | null;
  rating_count: number | null;
  status: ProspectStatus;
  notes: string | null;
  contacted_at: string | null;
  created_at: string;
  isClient: boolean;
};

type SearchLog = { kind: string; city: string; result_count: number; searched_at: string };

const TEMPLATES_KEY = 'domu_prospect_templates';
const PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
/** requirePlatformAdmin limita 40 chamadas/min; buscas reaproveitadas voltam na hora. */
const MIN_SEARCH_GAP_MS = 1600;

const MODULES = [...new Set(PROSPECT_KINDS.map((k) => k.module))];

const STATUS_STYLE: Record<ProspectStatus, string> = {
  NEW: 'bg-slate-50 text-slate-600 border-slate-200',
  CONTACTED: 'bg-sky-50 text-sky-700 border-sky-200',
  REPLIED: 'bg-violet-50 text-violet-700 border-violet-200',
  INTERESTED: 'bg-amber-50 text-amber-800 border-amber-200',
  CLIENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NOT_INTERESTED: 'bg-slate-100 text-slate-500 border-slate-200',
  INVALID: 'bg-red-50 text-red-600 border-red-200',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: Prospect[]) {
  const header = ['Nome', 'Tipo', 'Cidade', 'Endereço', 'Telefone', 'Celular', 'Instagram', 'Site', 'Nota', 'Avaliações', 'Status', 'Anotação', 'Maps'];
  const lines = rows.map((r) =>
    [
      r.name,
      prospectKind(r.kind)?.label || r.kind,
      r.city,
      r.address,
      r.phone,
      r.is_mobile ? 'sim' : 'não',
      r.instagram ? `@${r.instagram}` : '',
      r.website,
      r.rating,
      r.rating_count,
      PROSPECT_STATUS_LABELS[r.status],
      r.notes,
      r.maps_url,
    ]
      .map(csvCell)
      .join(';')
  );
  const blob = new Blob([`\uFEFF${[header.join(';'), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prospeccao-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

export default function ProspectingMonitor() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [searches, setSearches] = useState<SearchLog[]>([]);
  const [configured, setConfigured] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Busca no Google
  const [kinds, setKinds] = useState<string[]>(['lava_rapido', 'estetica_automotiva']);
  const [cities, setCities] = useState<string[]>(DEFAULT_CITIES);
  const [extraCity, setExtraCity] = useState('');
  const [force, setForce] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string; newLeads: number } | null>(null);
  const [searchError, setSearchError] = useState<{ message: string; detail?: string; failed: number; done: number } | null>(null);

  // Filtros da lista
  const [q, setQ] = useState('');
  const [fModule, setFModule] = useState<string>('all');
  const [fKind, setFKind] = useState<string>('all');
  const [fCity, setFCity] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [onlyMobile, setOnlyMobile] = useState(false);
  const [onlyInstagram, setOnlyInstagram] = useState(false);
  const [hideContacted, setHideContacted] = useState(true);
  const [hideClients, setHideClients] = useState(true);
  const [minRating, setMinRating] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    try {
      setTemplates(JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '{}'));
    } catch {
      /* modelos corrompidos: volta ao padrão */
    }
  }, []);

  const saveTemplate = (module: string, text: string) => {
    const next = { ...templates, [module]: text };
    setTemplates(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  };
  const templateFor = (module: TenantSegment) => templates[module] || DEFAULT_TEMPLATES[module] || DEFAULT_TEMPLATES.geral;

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/interno/prospects', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar os leads.');
        return;
      }
      setProspects(json.prospects);
      setSearches(json.searches);
      setConfigured(json.configured);
      setNeedsMigration(Boolean(json.needsMigration));
      setError('');
    } catch {
      setError('Não foi possível carregar os leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const searchedAt = useMemo(() => {
    const m = new Map<string, SearchLog>();
    for (const s of searches) m.set(`${s.kind}|${s.city}`, s);
    return m;
  }, [searches]);

  const combos = kinds.flatMap((k) => cities.map((c) => ({ kind: k, city: c })));
  const freshCount = combos.filter((c) => {
    const s = searchedAt.get(`${c.kind}|${c.city}`);
    return s && Date.now() - new Date(s.searched_at).getTime() < SEARCH_REUSE_DAYS * DAY_MS;
  }).length;
  const billable = force ? combos.length : combos.length - freshCount;

  const runSearch = async () => {
    if (!combos.length || progress) return;
    setError('');
    setSearchError(null);
    let newLeads = 0;
    let failed = 0;
    let lastError: { message: string; detail?: string } | null = null;
    let done = 0;
    for (let i = 0; i < combos.length; i++) {
      const { kind, city } = combos[i];
      const label = `${prospectKind(kind)?.label} em ${city}`;
      setProgress({ done: i, total: combos.length, label, newLeads });
      const started = Date.now();
      let stop = false;
      try {
        const res = await fetch('/api/interno/prospects/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, city, force }),
        });
        const json = await res.json().catch(() => null);
        if (!json?.success) {
          failed++;
          lastError = {
            message: json?.error || `O servidor respondeu ${res.status} em "${label}".`,
            detail: json?.detail,
          };
          // Erro de configuração/limite se repete em todas: para logo.
          stop = res.status === 503 || res.status === 429 || res.status === 502 || res.status === 404;
        } else {
          newLeads += json.inserted || 0;
        }
      } catch {
        failed++;
        lastError = { message: `Sem resposta do servidor em "${label}".` };
      }
      done = i + 1;
      if (stop) break;
      const wait = MIN_SEARCH_GAP_MS - (Date.now() - started);
      if (wait > 0 && i < combos.length - 1) await sleep(wait);
    }
    if (lastError) setSearchError({ ...lastError, failed, done });
    setProgress({ done, total: combos.length, label: failed ? `${failed} busca(s) com erro` : 'Concluído', newLeads });
    await load();
    setTimeout(() => setProgress(null), failed ? 15000 : 6000);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return prospects.filter(
      (p) =>
        (fModule === 'all' || p.module === fModule) &&
        (fKind === 'all' || p.kind === fKind) &&
        (fCity === 'all' || p.city === fCity) &&
        (fStatus === 'all' || p.status === fStatus) &&
        (!onlyMobile || p.is_mobile) &&
        (!onlyInstagram || p.instagram) &&
        (!hideContacted || fStatus !== 'all' || p.status === 'NEW') &&
        (!hideClients || (!p.isClient && p.status !== 'CLIENT') || fStatus === 'CLIENT') &&
        (!minRating || (p.rating ?? 0) >= minRating) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.address || '').toLowerCase().includes(term) ||
          (p.instagram || '').includes(term) ||
          (p.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '\u0000'))
    );
  }, [prospects, q, fModule, fKind, fCity, fStatus, onlyMobile, onlyInstagram, hideContacted, hideClients, minRating]);

  useEffect(() => setVisible(PAGE_SIZE), [filtered.length]);

  const cityOptions = useMemo(() => [...new Set(prospects.map((p) => p.city).filter(Boolean) as string[])].sort(), [prospects]);
  const stats = useMemo(
    () => ({
      total: prospects.length,
      mobile: prospects.filter((p) => p.is_mobile).length,
      instagram: prospects.filter((p) => p.instagram).length,
      contacted: prospects.filter((p) => p.status !== 'NEW' && p.status !== 'INVALID').length,
      interested: prospects.filter((p) => p.status === 'INTERESTED' || p.status === 'CLIENT').length,
    }),
    [prospects]
  );

  const patch = async (ids: string[], data: { status?: ProspectStatus; notes?: string; markContacted?: boolean }) => {
    setProspects((list) =>
      list.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              ...(data.status ? { status: data.status } : {}),
              ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
              ...(data.markContacted ? { contacted_at: new Date().toISOString() } : {}),
            }
          : p
      )
    );
    const res = await fetch('/api/interno/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, ...data }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!json?.success) {
      setError(json?.error || 'Não foi possível salvar. Recarregando…');
      load();
    }
  };

  const openWhatsApp = (p: Prospect) => {
    const number = whatsappNumber(p.phone_intl || p.phone);
    if (!number) return;
    const text = fillTemplate(templateFor(p.module), { nome: p.name, cidade: p.city });
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    if (p.status === 'NEW') patch([p.id], { status: 'CONTACTED', markContacted: true });
  };

  const toggleKind = (id: string) => setKinds((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));
  const toggleCity = (c: string) => setCities((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const toggleModuleKinds = (module: string) => {
    const ids = PROSPECT_KINDS.filter((k) => k.module === module).map((k) => k.id);
    const all = ids.every((id) => kinds.includes(id));
    setKinds((k) => (all ? k.filter((x) => !ids.includes(x)) : [...new Set([...k, ...ids])]));
  };
  const addExtraCity = () => {
    const c = extraCity.trim().replace(/\s+/g, ' ');
    if (c.length >= 2 && !cities.includes(c)) setCities((l) => [...l, c]);
    setExtraCity('');
  };

  const shown = filtered.slice(0, visible);
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));

  return (
    <div className="space-y-5">
      {needsMigration ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Falta rodar a migration <strong>20261021_prospects.sql</strong> no Supabase para salvar os leads.
        </p>
      ) : null}
      {!configured ? (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          <p className="font-bold">Falta a chave do Google para buscar.</p>
          <p className="text-xs">
            Ative a <strong>Places API (New)</strong> no projeto do Google Cloud da sua chave do Gemini (ou coloque outra chave em{' '}
            <code>GOOGLE_PLACES_API_KEY</code> na Vercel). Os leads já salvos continuam aparecendo.
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </p>
      ) : null}

      {/* ───────── Buscar no Google ───────── */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-black text-slate-900">Buscar estabelecimentos</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Busca no Google Maps cada tipo em cada cidade (até 60 por busca) e salva aqui. Repetir a mesma busca em menos de{' '}
            {SEARCH_REUSE_DAYS} dias não gasta cota.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tipos</p>
          {MODULES.map((module) => (
            <div key={module} className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleModuleKinds(module)}
                className="text-[11px] font-black text-domu-blue hover:underline w-40 text-left shrink-0"
              >
                {SEGMENT_LABELS[module]}
              </button>
              {PROSPECT_KINDS.filter((k) => k.module === module).map((k) => (
                <Chip key={k.id} active={kinds.includes(k.id)} onClick={() => toggleKind(k.id)}>
                  {k.label}
                </Chip>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cidades</p>
          <div className="flex flex-wrap gap-1.5">
            {[...REGION_CITIES, ...cities.filter((c) => !(REGION_CITIES as readonly string[]).includes(c))].map((c) => (
              <Chip key={c} active={cities.includes(c)} onClick={() => toggleCity(c)}>
                {c}
              </Chip>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addExtraCity();
              }}
              className="flex items-center gap-1"
            >
              <input
                value={extraCity}
                onChange={(e) => setExtraCity(e.target.value)}
                placeholder="Outra cidade de SP"
                maxLength={60}
                className="text-[11px] border border-slate-200 rounded-full px-2.5 py-1 w-36 focus:outline-none focus:border-domu-blue"
              />
            </form>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={runSearch}
            disabled={!combos.length || Boolean(progress && progress.done < progress.total) || !configured || needsMigration}
            className="inline-flex items-center gap-2 bg-domu-blue text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {progress && progress.done < progress.total ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar {combos.length} combinação(ões)
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Buscar de novo o que já foi buscado
          </label>
          <span className="text-[11px] text-slate-500">
            {billable} busca(s) no Google (até {billable * 3} chamadas cobradas){freshCount && !force ? ` · ${freshCount} já feita(s), reaproveitada(s)` : ''}
          </span>
        </div>

        {progress ? (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-domu-blue transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="text-[11px] text-slate-500">
              {progress.done}/{progress.total} · {progress.label} · {progress.newLeads} lead(s) novo(s)
            </p>
          </div>
        ) : null}

        {searchError ? (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <p className="font-bold">
                {searchError.failed} de {searchError.done} busca(s) falharam. {searchError.message}
              </p>
              {searchError.detail ? <p className="font-mono text-[11px] break-all">Google: {searchError.detail}</p> : null}
            </div>
            <button type="button" onClick={() => setSearchError(null)} aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </section>

      {/* ───────── Resumo ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ['Leads salvos', stats.total],
          ['Com celular', stats.mobile],
          ['Com Instagram', stats.instagram],
          ['Contatados', stats.contacted],
          ['Interessados', stats.interested],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-0.5 text-xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* ───────── Modelos de mensagem ───────── */}
      <section className="bg-white rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-black text-slate-900"
        >
          Mensagens prontas por módulo
          <span className="text-[11px] font-bold text-domu-blue">{showTemplates ? 'Fechar' : 'Editar'}</span>
        </button>
        {showTemplates ? (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-[11px] text-slate-500">
              Use <code>{'{nome}'}</code> para o nome do estabelecimento e <code>{'{cidade}'}</code> para a cidade. Fica salvo neste navegador.
            </p>
            {MODULES.map((module) => (
              <label key={module} className="block">
                <span className="text-[11px] font-bold text-slate-600">{SEGMENT_LABELS[module]}</span>
                <textarea
                  value={templateFor(module)}
                  onChange={(e) => saveTemplate(module, e.target.value)}
                  rows={3}
                  className="mt-1 w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-domu-blue"
                />
              </label>
            ))}
          </div>
        ) : null}
      </section>

      {/* ───────── Lista ───────── */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, endereço, telefone ou @instagram"
                className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-domu-blue"
              />
            </div>
            <select value={fModule} onChange={(e) => { setFModule(e.target.value); setFKind('all'); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="all">Todos os módulos</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {SEGMENT_LABELS[m]}
                </option>
              ))}
            </select>
            <select value={fKind} onChange={(e) => setFKind(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="all">Todos os tipos</option>
              {PROSPECT_KINDS.filter((k) => fModule === 'all' || k.module === fModule).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <select value={fCity} onChange={(e) => setFCity(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="all">Todas as cidades</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value="all">Todos os status</option>
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROSPECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
              <option value={0}>Qualquer nota</option>
              <option value={4}>Nota 4+</option>
              <option value={4.5}>Nota 4,5+</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              aria-label="Atualizar"
              className="text-slate-600 border border-slate-200 rounded-lg p-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={onlyMobile} onChange={(e) => setOnlyMobile(e.target.checked)} /> Só celular (WhatsApp)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={onlyInstagram} onChange={(e) => setOnlyInstagram(e.target.checked)} /> Tem Instagram
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={hideContacted} onChange={(e) => setHideContacted(e.target.checked)} /> Só os novos (esconder já contatados)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={hideClients} onChange={(e) => setHideClients(e.target.checked)} /> Esconder quem já é cliente
            </label>
            <span className="ml-auto text-[11px] text-slate-400">{filtered.length} resultado(s)</span>
          </div>
        </div>

        {selected.size ? (
          <div className="px-4 py-2 bg-slate-900 text-white text-xs flex flex-wrap items-center gap-3">
            <span className="font-bold">{selected.size} selecionado(s)</span>
            <select
              value=""
              onChange={(e) => {
                const status = e.target.value as ProspectStatus;
                if (status) patch([...selected], { status, markContacted: status === 'CONTACTED' });
              }}
              className="text-slate-900 rounded px-2 py-1"
            >
              <option value="">Marcar como…</option>
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROSPECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => exportCsv(prospects.filter((p) => selected.has(p.id)))} className="inline-flex items-center gap-1 font-bold">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto font-bold opacity-80">
              Limpar seleção
            </button>
          </div>
        ) : null}

        {loading && !prospects.length ? (
          <p className="px-4 py-8 text-sm text-slate-500">Carregando…</p>
        ) : !filtered.length ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {prospects.length ? 'Nenhum lead com esses filtros.' : 'Nenhum lead ainda. Escolha os tipos e as cidades acima e clique em Buscar.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[980px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pl-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allShownSelected}
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          shown.forEach((p) => (allShownSelected ? next.delete(p.id) : next.add(p.id)));
                          return next;
                        })
                      }
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="px-3 py-2 font-bold">Estabelecimento</th>
                  <th className="px-3 py-2 font-bold">Contato</th>
                  <th className="px-3 py-2 font-bold">Abrir</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const wa = whatsappNumber(p.phone_intl || p.phone);
                  return (
                    <React.Fragment key={p.id}>
                      <tr className={`border-t border-slate-100 align-top ${selected.has(p.id) ? 'bg-domu-blue/5' : ''}`}>
                        <td className="pl-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() =>
                              setSelected((s) => {
                                const next = new Set(s);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              })
                            }
                            aria-label={`Selecionar ${p.name}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 max-w-[340px]">
                          <p className="font-bold text-slate-900">
                            {p.name}
                            {p.isClient ? (
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                                Já é cliente
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {prospectKind(p.kind)?.label || p.kind} · {p.city || '—'}
                            {p.rating != null ? (
                              <span className="inline-flex items-center gap-0.5 ml-1.5 text-amber-600 font-bold">
                                <Star className="w-3 h-3 fill-current" /> {p.rating.toFixed(1).replace('.', ',')}
                                <span className="text-slate-400 font-normal">({p.rating_count ?? 0})</span>
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate" title={p.address || ''}>
                            {p.address}
                          </p>
                          {p.notes && openNotes !== p.id ? <p className="mt-1 text-[11px] text-slate-600 italic">“{p.notes}”</p> : null}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {p.phone ? (
                            <p className="font-bold text-slate-700">
                              {formatPhone(p.phone)}{' '}
                              <span className={`text-[10px] font-bold ${p.is_mobile ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {p.is_mobile ? 'celular' : 'fixo'}
                              </span>
                            </p>
                          ) : (
                            <p className="text-slate-400">Sem telefone</p>
                          )}
                          {p.instagram ? (
                            <a
                              href={`https://www.instagram.com/${p.instagram}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-pink-600 hover:underline mt-0.5"
                            >
                              <AtSign className="w-3.5 h-3.5" /> @{p.instagram}
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.city || ''} site:instagram.com`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-pink-600 mt-0.5"
                            >
                              <AtSign className="w-3.5 h-3.5" /> procurar
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openWhatsApp(p)}
                              disabled={!wa}
                              title={wa ? 'Abrir o WhatsApp com a mensagem pronta' : 'Sem número válido'}
                              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                            {p.maps_url ? (
                              <a
                                href={p.maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver no Google Maps"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-domu-blue/40"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setOpenNotes(openNotes === p.id ? null : p.id)}
                              title="Anotação"
                              className={`p-1.5 rounded-lg border ${p.notes ? 'border-amber-300 text-amber-600' : 'border-slate-200 text-slate-600'}`}
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={p.status}
                            onChange={(e) => patch([p.id], { status: e.target.value as ProspectStatus, markContacted: e.target.value === 'CONTACTED' })}
                            className={`text-[11px] font-bold border rounded-full px-2 py-1 ${STATUS_STYLE[p.status]}`}
                          >
                            {PROSPECT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {PROSPECT_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          {p.contacted_at ? (
                            <p className="text-[10px] text-slate-400 mt-1">
                              contato em {new Date(p.contacted_at).toLocaleDateString('pt-BR')}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                      {openNotes === p.id ? (
                        <tr className="bg-amber-50/40">
                          <td />
                          <td colSpan={4} className="px-3 pb-3">
                            <textarea
                              defaultValue={p.notes || ''}
                              autoFocus
                              maxLength={2000}
                              rows={2}
                              placeholder="Ex.: falei com o dono, pediu para chamar semana que vem"
                              onBlur={(e) => {
                                if (e.target.value !== (p.notes || '')) patch([p.id], { notes: e.target.value });
                                setOpenNotes(null);
                              }}
                              className="w-full text-xs border border-amber-200 rounded-lg p-2 focus:outline-none focus:border-amber-400"
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > visible ? (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-full py-2.5 text-xs font-bold text-domu-blue border-t border-slate-100 hover:bg-slate-50"
          >
            Mostrar mais ({filtered.length - visible} restantes)
          </button>
        ) : null}
        {filtered.length ? (
          <div className="px-4 py-2 border-t border-slate-100 flex justify-end">
            <button type="button" onClick={() => exportCsv(filtered)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-domu-blue">
              <Download className="w-3.5 h-3.5" /> Exportar os {filtered.length} filtrados (CSV)
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
