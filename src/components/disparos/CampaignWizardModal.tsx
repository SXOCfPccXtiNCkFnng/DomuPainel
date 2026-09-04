'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import WhatsAppPreview, { renderTemplateVariables } from '@/components/shared/WhatsAppPreview';
import ImageSourceField from '@/components/shared/ImageSourceField';
import {
  X,
  Send,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  RefreshCw,
  Lock,
  Check,
  Calendar,
  Zap,
  Search,
  ExternalLink,
} from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';
import { BILLING_PAY_PATH, redirectIfDispatchBlocked } from '@/lib/billingGuard';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  INTEREST_OPTIONS,
  REGION_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
} from '@/lib/contactTags';

export type CampaignStartPayload = {
  title: string;
  templateName: string;
  count: number;
  scheduledAt?: string | null;
  leadIds: string[];
  propertyId?: string | null;
  campaignId?: string;
  status?: string;
};

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCampaign: (payload: CampaignStartPayload) => void;
  initialPropertyTitle?: string;
  initialPropertyId?: string;
}

interface LeadContact {
  id: string;
  name: string;
  phone: string;
  interest_segment?: string | null;
  region?: string | null;
  interest_property_type?: string | null;
  budget_max?: number | null;
}

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">{children}</label>
  );
}

function formatPhoneShort(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) {
    return `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  }
  return phone;
}

export default function CampaignWizardModal({
  isOpen,
  onClose,
  onStartCampaign,
  initialPropertyTitle,
  initialPropertyId,
}: CampaignWizardModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('Nova Campanha de Envios');

  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [filterInterest, setFilterInterest] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');

  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>('');

  const [dispatchTiming, setDispatchTiming] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const metaTierLimit = 1000;

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [campaignImageUrl, setCampaignImageUrl] = useState<string>(
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80'
  );
  const [variableTestName, setVariableTestName] = useState('Carlos Eduardo');
  const [companyName, setCompanyName] = useState('Sua Empresa');

  useEffect(() => {
    setMounted(true);
    const saved = getAuthItem('domu_company_name');
    if (saved) setCompanyName(saved);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setTitle(
      initialPropertyTitle
        ? `Campanha · ${initialPropertyTitle}`
        : 'Nova Campanha de Envios'
    );
    setContactSearch('');
    setFilterInterest('');
    setFilterRegion('');
    setFilterType('');
    setFilterBudget('');
    setPropertyId(initialPropertyId || '');
    setDispatchTiming('IMMEDIATE');
    setIsSubmitting(false);
    fetchLeads();
    fetchTemplates();
    fetchProperties();
  }, [isOpen, initialPropertyId, initialPropertyTitle]);

  const fetchLeads = async () => {
    setIsLoadingContacts(true);
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const params = new URLSearchParams({ tenantId: storedTenantId });
      if (filterInterest) params.set('interest', filterInterest);
      if (filterRegion) params.set('region', filterRegion);
      if (filterType) params.set('propertyType', filterType);
      if (filterBudget) params.set('budgetMax', filterBudget);
      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      if (json.success && json.leads) {
        const list: LeadContact[] = json.leads;
        setContacts(list);
        setSelectedIds(new Set(list.map((c) => c.id)));
      }
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/properties?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success) setProperties(json.properties || []);
    } catch (err) {
      console.error('Erro ao carregar imóveis:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/templates?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.templates) {
        const approvedOnly = json.templates.filter((t: any) => t.status === 'APPROVED');
        const activeList = approvedOnly.length > 0 ? approvedOnly : json.templates;
        setTemplates(activeList);
        if (activeList.length > 0) {
          const initialTpl = activeList[0];
          setSelectedTemplate(initialTpl);
          if (initialTpl.header_content) setCampaignImageUrl(initialTpl.header_content);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void redirectIfDispatchBlocked().then((blocked) => {
      if (blocked) onClose();
    });
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInterest, filterRegion, filterType, filterBudget]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }, [contacts, contactSearch]);

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.has(c.id));

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredContacts.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredContacts.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(contacts.map((c) => c.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen || !mounted) return null;

  const rawTargetCount = selectedCount;
  const isMetaLimitReached = rawTargetCount > metaTierLimit;
  const targetCount = Math.min(rawTargetCount, metaTierLimit);

  const hasImageHeader =
    selectedTemplate?.header_type === 'IMAGE' ||
    Boolean(selectedTemplate?.header_content) ||
    Boolean(campaignImageUrl && selectedTemplate?.name?.includes('imagem'));

  const getRenderedPreviewText = () => {
    if (!selectedTemplate) return 'Selecione um template aprovado para visualizar o preview.';
    return renderTemplateVariables(selectedTemplate.body_text || '', {
      nome: variableTestName || 'Cliente',
      horario: '15:00',
    });
  };

  const handleFinishAndStart = async () => {
    if (!selectedTemplate || targetCount === 0 || isSubmitting) return;
    setIsSubmitting(true);
    const finalScheduledAt =
      dispatchTiming === 'SCHEDULED' ? `${scheduledDate}T${scheduledTime}:00` : null;
    const leadIds = Array.from(selectedIds).slice(0, metaTierLimit);

    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name: title,
          templateName: selectedTemplate.name,
          templateId: selectedTemplate.id,
          leadIds,
          propertyId: propertyId || null,
          scheduledAt: finalScheduledAt,
          segment: filterInterest || filterRegion || 'geral',
        }),
      });
      const json = await res.json();
      if (res.status === 402) {
        window.location.assign(BILLING_PAY_PATH);
        return;
      }
      if (!json.success) {
        alert(json.error || 'Erro ao criar campanha.');
        setIsSubmitting(false);
        return;
      }

      onStartCampaign({
        title,
        templateName: selectedTemplate.name,
        count: leadIds.length,
        scheduledAt: finalScheduledAt,
        leadIds,
        propertyId: propertyId || null,
        campaignId: json.campaign?.id,
        status: json.campaign?.status,
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Falha ao registrar campanha.');
      setIsSubmitting(false);
    }
  };

  const canContinue = selectedCount > 0;

  const steps = ['Destinatários', 'Template'];

  const modalMarkup = (
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 font-sans"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 sm:px-8 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Novo Disparo em Massa</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha quem recebe, agende e defina o template
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-6 shrink-0">
          {steps.map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (num === 2 && !canContinue) return;
                  setStep(num as 1 | 2);
                }}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  active ? 'text-domu-blue' : done ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold border rounded-md ${
                    active
                      ? 'border-domu-blue bg-domu-blue text-white'
                      : done
                        ? 'border-domu-blue text-domu-blue bg-white'
                        : 'border-slate-300 text-slate-400 bg-white'
                  }`}
                >
                  {done ? <Check className="w-3 h-3" /> : num}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
          <div className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-100">
            {step === 1 && (
              <>
                <div>
                  <SectionLabel>Nome da campanha</SectionLabel>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Campanha de Ofertas — Setembro"
                    className={inputClass}
                  />
                </div>

                <div>
                  <SectionLabel>Quando enviar</SectionLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDispatchTiming('IMMEDIATE')}
                      className={`px-3 py-2.5 text-left flex items-center gap-2 border rounded-xl transition-colors ${
                        dispatchTiming === 'IMMEDIATE'
                          ? 'bg-blue-50 text-domu-blue border-domu-blue'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Enviar agora</p>
                        <p className="text-[10px] text-slate-500">Disparo imediato</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDispatchTiming('SCHEDULED')}
                      className={`px-3 py-2.5 text-left flex items-center gap-2 border rounded-xl transition-colors ${
                        dispatchTiming === 'SCHEDULED'
                          ? 'bg-blue-50 text-domu-blue border-domu-blue'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Agendar</p>
                        <p className="text-[10px] text-slate-500">Data e hora</p>
                      </div>
                    </button>
                  </div>

                  {dispatchTiming === 'SCHEDULED' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <SectionLabel>Data</SectionLabel>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <SectionLabel>Horário</SectionLabel>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <SectionLabel>Imóvel vinculado (opcional)</SectionLabel>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sem imóvel específico</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `${p.code} · ` : ''}
                        {p.title}
                        {p.neighborhood ? ` — ${p.neighborhood}` : ''}
                      </option>
                    ))}
                  </select>
                  {properties.length === 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Cadastre imóveis em Imóveis (quando liberado) ou via API — o vínculo fica
                      salvo na campanha.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                    <SectionLabel>
                      Destinatários ({selectedCount} de {contacts.length} selecionados)
                    </SectionLabel>
                    <Link
                      href="/contatos"
                      onClick={onClose}
                      className="text-[11px] font-semibold text-domu-blue hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      Gerenciar base
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <select
                      value={filterInterest}
                      onChange={(e) => setFilterInterest(e.target.value)}
                      className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg"
                    >
                      <option value="">Interesse</option>
                      {INTEREST_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterRegion}
                      onChange={(e) => setFilterRegion(e.target.value)}
                      className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg"
                    >
                      <option value="">Região</option>
                      {REGION_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg"
                    >
                      <option value="">Tipo</option>
                      {PROPERTY_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterBudget}
                      onChange={(e) => setFilterBudget(e.target.value)}
                      className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg"
                    >
                      <option value="">Faixa de preço</option>
                      {BUDGET_OPTIONS.map((o) => (
                        <option key={o.max} value={o.max}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {contacts.length === 0 && !isLoadingContacts ? (
                    <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center space-y-2">
                      <p className="text-xs text-slate-600">
                        Nenhum contato no banco. Importe sua lista antes de disparar.
                      </p>
                      <Link
                        href="/contatos"
                        onClick={onClose}
                        className="btn-domu-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Ir para Contatos
                      </Link>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="search"
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            placeholder="Filtrar por nome ou telefone..."
                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-domu-blue"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={selectAll}
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-domu-blue"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            Nenhum
                          </button>
                          <button
                            type="button"
                            onClick={
                              allFilteredSelected ? deselectAllFiltered : selectAllFiltered
                            }
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-domu-blue"
                          >
                            {allFilteredSelected ? 'Limpar filtro' : 'Marcar filtrados'}
                          </button>
                          <button
                            type="button"
                            onClick={fetchLeads}
                            className="text-[10px] font-bold px-2 py-1 rounded-md text-domu-blue hover:bg-blue-50 flex items-center gap-1"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${isLoadingContacts ? 'animate-spin' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {isLoadingContacts ? (
                          <p className="p-4 text-xs text-slate-500 text-center">
                            Carregando contatos...
                          </p>
                        ) : filteredContacts.length === 0 ? (
                          <p className="p-4 text-xs text-slate-500 text-center">
                            Nenhum contato neste filtro.
                          </p>
                        ) : (
                          filteredContacts.map((contact) => {
                            const checked = selectedIds.has(contact.id);
                            return (
                              <label
                                key={contact.id}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                  checked ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleContact(contact.id)}
                                  className="w-3.5 h-3.5 accent-[#1E5AF6] shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-900 truncate">
                                    {contact.name}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {formatPhoneShort(contact.phone)}
                                  </p>
                                </div>
                                {checked && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-domu-blue shrink-0" />
                                )}
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <SectionLabel>Template aprovado pela Meta</SectionLabel>
                  <select
                    value={selectedTemplate?.name || ''}
                    onChange={(e) => {
                      const found = templates.find((t) => t.name === e.target.value);
                      if (found) {
                        setSelectedTemplate(found);
                        if (found.header_content) setCampaignImageUrl(found.header_content);
                      }
                    }}
                    className={inputClass}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.name}>
                        {tpl.is_global !== false ? '[PADRÃO DOMU] ' : '[MINHA EMPRESA] '}
                        {tpl.name} — {tpl.category}
                        {tpl.header_type === 'IMAGE' ? ' (com imagem)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {hasImageHeader && (
                  <ImageSourceField
                    value={campaignImageUrl}
                    onChange={setCampaignImageUrl}
                    label="Imagem do banner da campanha"
                    hint="Cole uma URL ou faça upload. A Meta usa essa imagem no disparo."
                  />
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <SectionLabel>Texto do template</SectionLabel>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Aprovado Meta
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed rounded-xl">
                    {selectedTemplate?.body_text ||
                      'Olá {{nome}}! Temos uma novidade especial para você.'}
                  </div>
                </div>

                <div>
                  <SectionLabel>Nome de teste no preview</SectionLabel>
                  <input
                    type="text"
                    value={variableTestName}
                    onChange={(e) => setVariableTestName(e.target.value)}
                    placeholder="ex: Carlos Eduardo"
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-5 p-6 bg-slate-50/80 flex flex-col">
            <WhatsAppPreview
              bodyText={getRenderedPreviewText()}
              showImage={hasImageHeader}
              imageUrl={campaignImageUrl}
              contactName={companyName}
              companyLabel="Atendimento Oficial"
              footer={
                <>
                  <p className="text-[11px] text-slate-600">
                    {dispatchTiming === 'SCHEDULED'
                      ? `Agendado para ${scheduledDate} às ${scheduledTime}`
                      : 'Disparo imediato'}
                    {' · '}
                    <span className="font-semibold text-slate-800">{targetCount} contatos</span>
                  </p>
                  {isMetaLimitReached && (
                    <p className="text-[10px] text-amber-700 flex items-center justify-center gap-1 mt-1">
                      <Lock className="w-3 h-3" />
                      Limite Meta Tier 1: máx. 1.000/dia
                    </p>
                  )}
                </>
              }
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setStep(Math.max(1, step - 1) as 1 | 2)}
            disabled={step === 1}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
          >
            Voltar
          </button>

          {step === 1 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep(2)}
              className="btn-domu-primary text-xs py-2 px-5 disabled:opacity-40"
            >
              Continuar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishAndStart}
              disabled={targetCount === 0 || !selectedTemplate || isSubmitting}
              className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting
                ? 'Registrando…'
                : dispatchTiming === 'SCHEDULED'
                  ? 'Confirmar agendamento'
                  : 'Disparar agora'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
