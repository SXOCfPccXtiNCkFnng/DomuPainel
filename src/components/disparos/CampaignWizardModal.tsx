'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Send, 
  Eye, 
  ChevronRight, 
  Users, 
  UserPlus, 
  FileText, 
  CheckCircle2,
  RefreshCw,
  Lock,
  Sparkles,
  Check,
  Smartphone,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  MoreVertical,
  Wifi,
  ImageIcon,
  Calendar,
  Clock,
  Zap
} from 'lucide-react';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCampaign: (title: string, templateName: string, count: number, scheduledAt?: string | null) => void;
  initialPropertyTitle?: string;
}

export default function CampaignWizardModal({
  isOpen,
  onClose,
  onStartCampaign
}: CampaignWizardModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('Nova Campanha de Envios');
  
  // Contacts State
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedSendMode, setSelectedSendMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [customQuantity, setCustomQuantity] = useState<number>(50);
  const [showImportBox, setShowImportBox] = useState(false);
  const [pastedContacts, setPastedContacts] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Dispatch Scheduling State (Immediate vs Scheduled)
  const [dispatchTiming, setDispatchTiming] = useState<'IMMEDIATE' | 'SCHEDULED'>('IMMEDIATE');
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');

  // Meta Health & Tier Limits State (Automated)
  const metaTierLimit = 1000; // Tier 1 limit
  const metaHealthStatus = 'VERDE'; // Account Health

  // Template & Image Header State
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [campaignImageUrl, setCampaignImageUrl] = useState<string>('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80');
  const [variableTestName, setVariableTestName] = useState('Carlos Eduardo');

  useEffect(() => {
    setMounted(true);
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
      if (json.success && json.leads) {
        setContacts(json.leads);
      }
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
          if (initialTpl.header_content) {
            setCampaignImageUrl(initialTpl.header_content);
          }
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
          body: JSON.stringify({
            tenantId: storedTenantId,
            contacts: contactsToSave
          })
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

  // Calculate dynamic send limit based on Meta Account Tier Health
  const rawTargetCount = selectedSendMode === 'ALL' ? (contacts.length || 100) : Math.min(customQuantity, contacts.length || 100);
  const isMetaLimitReached = rawTargetCount > metaTierLimit;
  const targetCount = Math.min(rawTargetCount, metaTierLimit);

  const hasImageHeader = selectedTemplate?.header_type === 'IMAGE' || Boolean(selectedTemplate?.header_content) || Boolean(campaignImageUrl && selectedTemplate?.name?.includes('imagem'));

  // Render locked template text with test name
  const getRenderedPreviewText = () => {
    if (!selectedTemplate) return 'Selecione um template aprovado para visualizar o preview.';
    let text = selectedTemplate.body_text || '';
    text = text.replace(/\{\{nome\}\}/g, variableTestName || 'Cliente');
    text = text.replace(/\{\{horario\}\}/g, '15:00');
    return text;
  };

  const handleFinishAndStart = () => {
    if (!selectedTemplate) return;
    const finalScheduledAt = dispatchTiming === 'SCHEDULED' ? `${scheduledDate} ${scheduledTime}` : null;
    onStartCampaign(title, selectedTemplate.name, targetCount, finalScheduledAt);
    onClose();
  };

  const modalMarkup = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-7 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">Assistente de Disparo em Massa</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Meta Cloud API
                </span>
              </div>
              <p className="text-xs text-slate-400">Configure os destinatários, agendamento e visualize o template oficial</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Step Stepper Bar */}
        <div className="px-8 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-center gap-8 text-xs font-bold">
          
          <div 
            onClick={() => setStep(1)}
            className={`flex items-center gap-2.5 cursor-pointer transition-all ${step === 1 ? 'text-domu-blue font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              step === 1 ? 'bg-domu-blue text-white shadow-md shadow-blue-500/30' : 'bg-slate-300 text-slate-700'
            }`}>
              1
            </div>
            <span className="text-sm">Destinatários & Agendamento</span>
          </div>

          <div className="w-16 h-0.5 bg-slate-300 rounded-full"></div>

          <div 
            onClick={() => setStep(2)}
            className={`flex items-center gap-2.5 cursor-pointer transition-all ${step === 2 ? 'text-domu-blue font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              step === 2 ? 'bg-domu-blue text-white shadow-md shadow-blue-500/30' : 'bg-slate-300 text-slate-700'
            }`}>
              2
            </div>
            <span className="text-sm">Template Meta & Preview</span>
          </div>

        </div>

        {/* Modal Content Body */}
        <div className="p-7 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-7 bg-slate-50/50">
          
          {/* Left Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* STEP 1: Destinatários & Agendamento de Data/Hora */}
            {step === 1 && (
              <div className="space-y-5">
                
                {/* Campaign Title Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Nome Identificador da Campanha
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Campanha de Ofertas - Setembro"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue transition-all shadow-xs"
                  />
                </div>

                {/* Dispatch Timing Selector (Immediate vs Scheduled Date/Time) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Momento do Disparo (Envio Imediato ou Agendado)
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    
                    {/* Option: Immediate */}
                    <div 
                      onClick={() => setDispatchTiming('IMMEDIATE')}
                      className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                        dispatchTiming === 'IMMEDIATE' 
                          ? 'border-domu-blue bg-blue-50/80 ring-2 ring-domu-blue/20' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        dispatchTiming === 'IMMEDIATE' ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">Enviar Agora</p>
                        <p className="text-[10.5px] text-slate-500">Disparo imediato</p>
                      </div>
                    </div>

                    {/* Option: Scheduled */}
                    <div 
                      onClick={() => setDispatchTiming('SCHEDULED')}
                      className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                        dispatchTiming === 'SCHEDULED' 
                          ? 'border-domu-blue bg-blue-50/80 ring-2 ring-domu-blue/20' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        dispatchTiming === 'SCHEDULED' ? 'bg-domu-blue text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">Agendar Envio</p>
                        <p className="text-[10.5px] text-slate-500">Escolher data/hora</p>
                      </div>
                    </div>

                  </div>

                  {/* Scheduled Date & Time Pickers */}
                  {dispatchTiming === 'SCHEDULED' && (
                    <div className="grid grid-cols-2 gap-3 pt-2 p-3 bg-blue-50/70 rounded-2xl border border-blue-200 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold text-slate-700 block">Data do Disparo</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full h-10 px-3 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-domu-blue focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold text-slate-700 block">Horário do Disparo</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full h-10 px-3 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-domu-blue focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Selection Mode Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Seleção de Destinatários
                      </h4>
                      <p className="text-[11px] text-slate-500">Escolha como selecionar a lista de telefones</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowImportBox(!showImportBox)}
                      className="px-3.5 py-1.5 bg-blue-50 text-domu-blue font-extrabold rounded-xl text-xs hover:bg-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{showImportBox ? 'Fechar Importador' : '+ Importar Lista'}</span>
                    </button>
                  </div>

                  {/* Inline Contact Importer */}
                  {showImportBox && (
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/70 rounded-2xl border border-blue-200 space-y-3 animate-in fade-in duration-150 shadow-xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Cole ou digite os contatos (Um por linha: Nome, Telefone)</span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder={`Carlos Silva, 11999998888\nMariana Souza, 11988887777`}
                        value={pastedContacts}
                        onChange={(e) => setPastedContacts(e.target.value)}
                        className="w-full p-3 text-xs border border-slate-300 rounded-xl bg-white font-mono text-slate-900 focus:ring-2 focus:ring-domu-blue focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleImportPastedContacts}
                        disabled={isImporting}
                        className="btn-domu-primary text-xs py-2 px-4 w-full justify-center shadow-xs"
                      >
                        {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        <span>Salvar Contatos na Conta</span>
                      </button>
                    </div>
                  )}

                  {/* Sending Mode Options */}
                  <div className="space-y-3 pt-1">
                    
                    {/* Option 1: All saved contacts */}
                    <div 
                      onClick={() => setSelectedSendMode('ALL')}
                      className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedSendMode === 'ALL' 
                          ? 'border-domu-blue bg-blue-50/70 ring-2 ring-domu-blue/20 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedSendMode === 'ALL' ? 'border-domu-blue bg-domu-blue text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedSendMode === 'ALL' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">Enviar para Todos os Contatos Salvos</p>
                          <p className="text-[11px] text-slate-500">Base de contatos salva na sua conta</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-domu-blue text-white shadow-xs">
                        {contacts.length > 0 ? `${contacts.length} Contatos` : 'Todos'}
                      </span>
                    </div>

                    {/* Option 2: Custom batch size */}
                    <div 
                      onClick={() => setSelectedSendMode('CUSTOM')}
                      className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedSendMode === 'CUSTOM' 
                          ? 'border-domu-blue bg-blue-50/70 ring-2 ring-domu-blue/20 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedSendMode === 'CUSTOM' ? 'border-domu-blue bg-domu-blue text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedSendMode === 'CUSTOM' && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">Especificar Lote / Quantidade Personalizada</p>
                          <p className="text-[11px] text-slate-500">Limite a quantidade de disparos para este envio</p>
                        </div>
                      </div>
                      
                      {selectedSendMode === 'CUSTOM' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            max={1000}
                            value={customQuantity}
                            onChange={(e) => setCustomQuantity(Number(e.target.value))}
                            className="w-20 h-9 px-3 text-xs border border-slate-300 rounded-xl text-slate-900 bg-white font-black text-center focus:ring-2 focus:ring-domu-blue focus:outline-none shadow-xs"
                          />
                          <span className="text-xs text-slate-600 font-extrabold">contatos</span>
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700">Lote</span>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* STEP 2: Template Meta HSM (Global vs Account Template Selector) */}
            {step === 2 && (
              <div className="space-y-5">
                
                {/* Meta Template Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Modelo de Template Meta Cloud API (Aprovado)
                  </label>
                  <select
                    value={selectedTemplate?.name || ''}
                    onChange={(e) => {
                      const found = templates.find(t => t.name === e.target.value);
                      if (found) {
                        setSelectedTemplate(found);
                        if (found.header_content) {
                          setCampaignImageUrl(found.header_content);
                        }
                      }
                    }}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue shadow-xs"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.name}>
                        {tpl.is_global !== false ? '🌐 [PADRÃO DOMU]' : '🏢 [MINHA EMPRESA]'} {tpl.name} ({tpl.category}) {tpl.header_type === 'IMAGE' ? '[COM IMAGEM]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Read-Only Locked Meta Template Display */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-4 h-4 text-domu-blue" />
                      Conteúdo do Template Aprovado Meta
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Texto Imutável Meta HSM
                    </span>
                  </div>

                  {/* Conditional Image Header URL Customizer */}
                  {hasImageHeader && (
                    <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-slate-800 space-y-2">
                      <div className="flex items-center justify-between font-extrabold text-domu-blue">
                        <span className="flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4" />
                          Imagem de Destaque da Mensagem (URL da Foto/Banner)
                        </span>
                        <span className="text-[10px] bg-blue-200 px-2 py-0.5 rounded text-blue-900 uppercase">Cabeçalho de Mídia</span>
                      </div>
                      <input
                        type="url"
                        value={campaignImageUrl}
                        onChange={(e) => setCampaignImageUrl(e.target.value)}
                        placeholder="https://suaempresa.com/imagem_anuncio.jpg"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:ring-2 focus:ring-domu-blue focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Locked Read-Only Template Text Display */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 leading-relaxed font-sans select-none">
                    "{selectedTemplate?.body_text || 'Olá {{nome}}! Temos uma novidade especial para você hoje.'}"
                  </div>

                  {/* Input for Testing Preview Name */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-black text-slate-700 block">
                      Digite um Nome Exemplo para Testar o Preview no WhatsApp
                    </label>
                    <input
                      type="text"
                      value={variableTestName}
                      onChange={(e) => setVariableTestName(e.target.value)}
                      placeholder="ex: Carlos Eduardo"
                      className="w-full h-10 px-4 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-domu-blue focus:outline-none transition-all"
                    />
                  </div>

                </div>

              </div>
            )}

          </div>

          {/* Right Sleek WhatsApp Phone Device Simulator (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-100 to-slate-200/80 p-4 rounded-3xl border border-slate-300 flex flex-col justify-between shadow-inner">
            <div>
              
              {/* Simulator Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-3">
                <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-domu-blue" />
                  Preview no WhatsApp
                </span>
                <span className="text-[10px] text-emerald-700 font-black bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Visualização Real
                </span>
              </div>

              {/* Realistic WhatsApp Header Bar */}
              <div className="bg-[#075E54] rounded-t-2xl px-4 py-3 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 border border-emerald-400/40 flex items-center justify-center text-xs font-black tracking-tight text-white shadow-xs">
                    DOMU
                  </div>
                  <div>
                    <h5 className="text-[12px] font-bold leading-none text-white">DOMU Bot</h5>
                    <span className="text-[9.5px] text-emerald-200 font-medium">Atendimento Oficial • Online</span>
                  </div>
                </div>
                <Smartphone className="w-4 h-4 text-white/80" />
              </div>

              {/* WhatsApp Message Bubble Card */}
              <div className="bg-[#E5DDD5] p-3.5 rounded-b-2xl border border-t-0 border-slate-300 shadow-inner min-h-[250px] flex flex-col justify-end">
                <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden space-y-2">
                  
                  {/* Seamless Image Banner if present */}
                  {hasImageHeader && (
                    <div className="w-full h-36 bg-slate-100 relative overflow-hidden border-b border-slate-100">
                      <img 
                        src={campaignImageUrl || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'} 
                        alt="Imagem da Campanha"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-3 space-y-1.5">
                    <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans font-normal">
                      {getRenderedPreviewText()}
                    </p>

                    <div className="flex items-center justify-end gap-1 text-[9.5px] text-slate-400 pt-0.5 font-sans">
                      <span>14:32</span>
                      <span className="text-blue-500 font-black tracking-tighter">✓✓</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            <div className="mt-4 pt-3 border-t border-slate-300 text-center space-y-1">
              <p className="text-xs text-slate-800 font-medium">
                Execução: <strong className="text-domu-blue font-black">{dispatchTiming === 'SCHEDULED' ? `Agendado (${scheduledDate} às ${scheduledTime})` : 'Disparo Imediato'}</strong>
              </p>
              <p className="text-xs text-slate-700 font-medium">
                Total estimado para envio: <strong className="text-slate-900 font-black">{targetCount} contatos</strong>
              </p>

              {isMetaLimitReached && (
                <p className="text-[10.5px] text-amber-800 font-extrabold bg-amber-100 p-2 rounded-xl border border-amber-200 flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-800" />
                  <span>Trava Meta Cloud API (Tier 1): Cap de 1.000/dia ativado.</span>
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-7 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Voltar
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="btn-domu-primary text-xs py-2.5 px-6 shadow-md shadow-blue-500/20"
            >
              <span>Próximo Passo (Template)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinishAndStart}
              className="btn-domu-primary text-xs py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{dispatchTiming === 'SCHEDULED' ? 'Confirmar Agendamento' : 'Disparar Mensagens Agora'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
