'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCampaign: (title: string, templateName: string, count: number, scheduledAt?: string | null) => void;
  initialPropertyTitle?: string;
}

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 transition-colors';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">
      {children}
    </label>
  );
}

function OptionRow({
  selected,
  onClick,
  title,
  subtitle,
  trailing,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border transition-colors flex items-center justify-between gap-3 ${
        selected
          ? 'border-domu-blue bg-blue-50/40'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
            selected ? 'border-domu-blue bg-domu-blue' : 'border-slate-300 bg-white'
          }`}
        >
          {selected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {trailing}
    </button>
  );
}

export default function CampaignWizardModal({
  isOpen,
  onClose,
  onStartCampaign,
}: CampaignWizardModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('Nova Campanha de Envios');

  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedSendMode, setSelectedSendMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [customQuantity, setCustomQuantity] = useState<number>(50);
  const [showImportBox, setShowImportBox] = useState(false);
  const [pastedContacts, setPastedContacts] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [dispatchTiming, setDispatchTiming] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');

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
    const saved = localStorage.getItem('domu_company_name');
    if (saved) setCompanyName(saved);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLeads();
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchLeads = async () => {
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/leads?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.leads) setContacts(json.leads);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
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

  const handleImportPastedContacts = async () => {
    if (!pastedContacts.trim()) return;
    setIsImporting(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const lines = pastedContacts.split('\n');
      const contactsToSave: { name: string; phone: string }[] = [];

      lines.forEach((line) => {
        const clean = line.trim();
        if (!clean) return;
        if (clean.includes(',')) {
          const [name, phone] = clean.split(',');
          contactsToSave.push({ name: name.trim(), phone: phone.trim() });
        } else if (clean.includes(';')) {
          const [name, phone] = clean.split(';');
          contactsToSave.push({ name: name.trim(), phone: phone.trim() });
        } else {
          contactsToSave.push({ name: 'Contato', phone: clean });
        }
      });

      if (contactsToSave.length > 0) {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: storedTenantId, contacts: contactsToSave }),
        });
        const json = await res.json();
        if (json.success) {
          setPastedContacts('');
          setShowImportBox(false);
          fetchLeads();
        }
      }
    } catch (err) {
      console.error('Erro ao salvar contatos:', err);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const rawTargetCount =
    selectedSendMode === 'ALL' ? contacts.length || 100 : Math.min(customQuantity, contacts.length || 100);
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

  const handleFinishAndStart = () => {
    if (!selectedTemplate) return;
    const finalScheduledAt = dispatchTiming === 'SCHEDULED' ? `${scheduledDate} ${scheduledTime}` : null;
    onStartCampaign(title, selectedTemplate.name, targetCount, finalScheduledAt);
    onClose();
  };

  const steps = ['Destinatários', 'Template'];

  const modalMarkup = (
    <div className="fixed inset-0 z-[99999] bg-slate-900/50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Novo Disparo em Massa</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Configure destinatários, agendamento e template</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-6 shrink-0">
          {steps.map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(num as 1 | 2)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  active ? 'text-domu-blue' : done ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold border ${
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">

          {/* Form */}
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
                  <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDispatchTiming('IMMEDIATE')}
                      className={`px-3 py-2.5 text-left flex items-center gap-2 transition-colors ${
                        dispatchTiming === 'IMMEDIATE' ? 'bg-blue-50 text-domu-blue' : 'bg-white text-slate-700 hover:bg-slate-50'
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
                      className={`px-3 py-2.5 text-left flex items-center gap-2 transition-colors ${
                        dispatchTiming === 'SCHEDULED' ? 'bg-blue-50 text-domu-blue' : 'bg-white text-slate-700 hover:bg-slate-50'
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
                  <div className="flex items-center justify-between mb-1.5">
                    <SectionLabel>Destinatários</SectionLabel>
                    <button
                      type="button"
                      onClick={() => setShowImportBox(!showImportBox)}
                      className="text-[11px] font-semibold text-domu-blue hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      {showImportBox ? 'Fechar' : 'Importar lista'}
                    </button>
                  </div>

                  {showImportBox && (
                    <div className="mb-3 p-3 border border-slate-200 bg-slate-50 space-y-2">
                      <textarea
                        rows={3}
                        placeholder={'Carlos Silva, 11999998888\nMariana Souza, 11988887777'}
                        value={pastedContacts}
                        onChange={(e) => setPastedContacts(e.target.value)}
                        className={`${inputClass} font-mono bg-white`}
                      />
                      <button
                        type="button"
                        onClick={handleImportPastedContacts}
                        disabled={isImporting}
                        className="btn-domu-primary text-xs py-1.5 px-3 w-full justify-center"
                      >
                        {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Salvar contatos'}
                      </button>
                    </div>
                  )}

                  <div className="space-y-px border border-slate-200">
                    <OptionRow
                      selected={selectedSendMode === 'ALL'}
                      onClick={() => setSelectedSendMode('ALL')}
                      title="Todos os contatos salvos"
                      subtitle="Base completa da sua conta"
                      trailing={
                        <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                          {contacts.length > 0 ? contacts.length : '—'}
                        </span>
                      }
                    />
                    <OptionRow
                      selected={selectedSendMode === 'CUSTOM'}
                      onClick={() => setSelectedSendMode('CUSTOM')}
                      title="Quantidade personalizada"
                      subtitle="Defina um limite para este envio"
                      trailing={
                        selectedSendMode === 'CUSTOM' ? (
                          <input
                            type="number"
                            max={1000}
                            value={customQuantity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setCustomQuantity(Number(e.target.value))}
                            className="w-16 px-2 py-1 text-xs border border-slate-200 text-center font-semibold focus:outline-none focus:border-domu-blue"
                          />
                        ) : null
                      }
                    />
                  </div>
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
                    hint="Você pode colar uma URL ou fazer upload. A Meta usa essa imagem no disparo — não precisa ser a mesma do cadastro do template, desde que seja do mesmo tipo de conteúdo (JPG/PNG, máx. 5 MB)."
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
                  <div className="p-3 bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {selectedTemplate?.body_text || 'Olá {{nome}}! Temos uma novidade especial para você.'}
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

          {/* Preview */}
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
          >
            Voltar
          </button>

          {step === 1 ? (
            <button onClick={() => setStep(2)} className="btn-domu-primary text-xs py-2 px-5">
              Continuar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleFinishAndStart}
              className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {dispatchTiming === 'SCHEDULED' ? 'Confirmar agendamento' : 'Disparar agora'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
