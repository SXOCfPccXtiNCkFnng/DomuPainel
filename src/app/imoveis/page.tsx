'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bath,
  BedDouble,
  Building2,
  Car,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Ruler,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import CampaignWizardModal, { CampaignStartPayload } from '@/components/disparos/CampaignWizardModal';
import CampaignProgress from '@/components/disparos/CampaignProgress';
import PropertyFormModal from '@/components/imoveis/PropertyFormModal';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import {
  normalizeSearch,
  OFFERABLE_STATUSES,
  priceLabel,
  PROPERTY_PURPOSES,
  PROPERTY_STATUSES,
  PURPOSE_LABELS,
  type RealEstateProperty,
} from '@/lib/realEstate';

const STATUS_STYLES: Record<string, string> = {
  Disponível: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Lançamento: 'bg-blue-50 text-domu-blue border-blue-200',
  Reservado: 'bg-amber-50 text-amber-700 border-amber-200',
  Vendido: 'bg-slate-100 text-slate-500 border-slate-200',
  Alugado: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ImoveisPage() {
  const [properties, setProperties] = useState<RealEstateProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ATIVOS');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [editing, setEditing] = useState<RealEstateProperty | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [wizardProperty, setWizardProperty] = useState<RealEstateProperty | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ limit: number; used: number; planName: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/properties');
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar os imóveis.');
        return;
      }
      setProperties(json.properties || []);
      setCatalog(json.catalog || null);
      setError(null);
    } catch {
      setError('Não foi possível carregar os imóveis.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return properties.filter((p) => {
      if (statusFilter === 'ATIVOS' && !OFFERABLE_STATUSES.includes(p.status)) return false;
      if (statusFilter !== 'ATIVOS' && statusFilter && p.status !== statusFilter) return false;
      if (purposeFilter && p.purpose !== purposeFilter && p.purpose !== 'VENDA_E_ALUGUEL') return false;
      if (!q) return true;
      return normalizeSearch(`${p.code} ${p.title} ${p.type} ${p.neighborhood || ''} ${p.city || ''}`).includes(q);
    });
  }, [properties, search, statusFilter, purposeFilter]);

  const offerableCount = properties.filter((p) => OFFERABLE_STATUSES.includes(p.status)).length;
  const lastCity = properties.find((p) => p.city)?.city || '';

  const openNew = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  // Recarrega para o contador do plano refletir a mudança.
  const onSaved = () => {
    load();
  };

  const remove = async (p: RealEstateProperty) => {
    const ok = await confirm({
      title: `Apagar o imóvel ${p.code}?`,
      message: `${p.title}. A atendente deixa de oferecer na hora.`,
      confirmLabel: 'Apagar imóvel',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/properties?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || 'Não foi possível apagar o imóvel.');
      return;
    }
    load();
  };

  const handleStartCampaign = (payload: CampaignStartPayload) => {
    if (payload.campaignId) setActiveCampaignId(payload.campaignId);
  };

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs text-slate-500">
            {properties.length
              ? `${offerableCount} disponíveis para a atendente oferecer · ${properties.length} no total`
              : 'Cadastre os imóveis que a atendente vai apresentar aos clientes.'}
          </p>
          {catalog && (
            <p className={`text-[11px] font-bold ${catalog.used >= catalog.limit ? 'text-amber-700' : 'text-slate-400'}`}>
              {catalog.used} de {catalog.limit} imóveis ativos no plano {catalog.planName}
              {catalog.used >= catalog.limit ? ' · limite atingido: marque como vendido/alugado os que saíram ou mude de plano' : ''}
            </p>
          )}
        </div>
        <button type="button" onClick={openNew} className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 w-fit">
          <Plus className="w-4 h-4" /> Cadastrar imóvel
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {activeCampaignId && <CampaignProgress campaignId={activeCampaignId} onClose={() => setActiveCampaignId(null)} />}

      {properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <label className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, título, bairro ou cidade"
              className={`${agendaInputClass} pl-9`}
              aria-label="Buscar imóvel"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={agendaInputClass}
            aria-label="Filtrar por situação"
          >
            <option value="ATIVOS">Disponíveis e lançamentos</option>
            <option value="">Todas as situações</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value)}
            className={agendaInputClass}
            aria-label="Filtrar por finalidade"
          >
            <option value="">Venda e aluguel</option>
            {PROPERTY_PURPOSES.filter((p) => p !== 'VENDA_E_ALUGUEL').map((p) => (
              <option key={p} value={p}>
                {PURPOSE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando imóveis...
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-3 max-w-xl mx-auto">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-domu-blue flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-black text-slate-900">Nenhum imóvel cadastrado</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            A atendente só apresenta o que está aqui, então cadastre os imóveis disponíveis com valor, bairro e o link
            das fotos. Eles também viram campanhas para a sua base de contatos.
          </p>
          <button type="button" onClick={openNew} className="btn-domu-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Cadastrar o primeiro imóvel
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500 bg-white border border-slate-200/80 rounded-2xl p-6 text-center">
          Nenhum imóvel com esses filtros.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <article key={p.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {p.code} · {p.type} · {PURPOSE_LABELS[p.purpose]}
                  </p>
                  <h3 className="text-sm font-black text-slate-900 leading-snug mt-0.5">{p.title}</h3>
                  {(p.neighborhood || p.city) && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{[p.neighborhood, p.city].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${STATUS_STYLES[p.status] || ''}`}>
                  {p.status}
                </span>
              </div>

              <p className="text-base font-black text-slate-900">{priceLabel(p)}</p>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                {p.bedrooms > 0 && (
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3.5 h-3.5" /> {p.bedrooms} quartos
                  </span>
                )}
                {p.bathrooms > 0 && (
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5" /> {p.bathrooms}
                  </span>
                )}
                {p.parking_spots > 0 && (
                  <span className="flex items-center gap-1">
                    <Car className="w-3.5 h-3.5" /> {p.parking_spots}
                  </span>
                )}
                {p.area_sqm > 0 && (
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5" /> {p.area_sqm} m²
                  </span>
                )}
              </div>

              {p.features.length > 0 && (
                <p className="text-[11px] text-slate-500 line-clamp-2">{p.features.join(' · ')}</p>
              )}
              {!p.link_url && OFFERABLE_STATUSES.includes(p.status) && (
                <p className="text-[10.5px] text-amber-700">Sem link de fotos: a atendente não tem o que mandar se pedirem.</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(p);
                    setIsFormOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                {OFFERABLE_STATUSES.includes(p.status) && (
                  <button
                    type="button"
                    onClick={() => setWizardProperty(p)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-domu-blue hover:bg-blue-50 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Campanha
                  </button>
                )}
                {p.link_url && (
                  <a
                    href={p.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Fotos
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="ml-auto px-2 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 flex items-center gap-1"
                  aria-label={`Apagar ${p.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PropertyFormModal
        isOpen={isFormOpen}
        property={editing}
        defaultCity={lastCity}
        onClose={() => setIsFormOpen(false)}
        onSaved={onSaved}
      />

      <CampaignWizardModal
        isOpen={Boolean(wizardProperty)}
        onClose={() => setWizardProperty(null)}
        onStartCampaign={handleStartCampaign}
        initialPropertyTitle={wizardProperty?.title}
        initialPropertyId={wizardProperty?.id}
      />
      {confirmDialog}
    </div>
  );
}
