'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Eye, 
  ChevronRight, 
  Users, 
  UserPlus, 
  FileText, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCampaign: (title: string, templateName: string, count: number) => void;
  initialPropertyTitle?: string;
}

export default function CampaignWizardModal({
  isOpen,
  onClose,
  onStartCampaign
}: CampaignWizardModalProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('Nova Campanha de Envios');
  
  // Contacts & Audience State
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedSendMode, setSelectedSendMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [customQuantity, setCustomQuantity] = useState<number>(50);
  const [showImportBox, setShowImportBox] = useState(false);
  const [pastedContacts, setPastedContacts] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Template & Custom Message State
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('aviso_promocao');
  const [customMessage, setCustomMessage] = useState('Olá {{nome}}! Temos uma super oferta e novidades para você hoje. Gostaria de saber mais?');
  const [variableName, setVariableName] = useState('Cliente');

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
      console.error('Erro ao carregar contatos do Supabase:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/templates?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.templates) {
        setTemplates(json.templates);
        if (json.templates.length > 0) {
          setSelectedTemplateName(json.templates[0].name);
          setCustomMessage(json.templates[0].body_text);
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
          fetchLeads(); // Reload leads from Supabase!
        }
      }
    } catch (err) {
      console.error('Erro ao salvar contatos:', err);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const targetCount = selectedSendMode === 'ALL' ? (contacts.length || 100) : Math.min(customQuantity, contacts.length || 100);

  const getRenderedPreviewText = () => {
    return customMessage.replace(/\{\{nome\}\}/g, variableName || 'Cliente');
  };

  const handleFinishAndStart = () => {
    onStartCampaign(title, selectedTemplateName, targetCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-domu-blue text-white flex items-center justify-center shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Assistente de Disparo em Massa</h3>
              <p className="text-xs text-slate-500">Configure os destinatários e o modelo de disparo</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Steps Indicator Bar */}
        <div className="px-6 py-3 bg-slate-900 text-white flex items-center justify-center gap-6 text-xs font-bold border-b border-slate-800">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-domu-blue' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${step === 1 ? 'bg-domu-blue text-white' : 'bg-slate-800'}`}>1</span>
            <span>Destinatários & Contatos</span>
          </div>

          <div className="w-12 h-0.5 bg-slate-800"></div>

          <div className={`flex items-center gap-2 ${step === 2 ? 'text-domu-blue' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${step === 2 ? 'bg-domu-blue text-white' : 'bg-slate-800'}`}>2</span>
            <span>Mensagem & Preview</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Step 1: Destinatários & Contatos */}
            {step === 1 && (
              <div className="space-y-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Título da Campanha</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex: Campanha de Lançamento"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue"
                  />
                </div>

                {/* Contacts Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Seleção de Destinatários</label>
                    <button
                      type="button"
                      onClick={() => setShowImportBox(!showImportBox)}
                      className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{showImportBox ? 'Fechar Importador' : '+ Importar / Digitar Contatos'}</span>
                    </button>
                  </div>

                  {/* Inline Import Box */}
                  {showImportBox && (
                    <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2 animate-in fade-in duration-150">
                      <label className="text-[11px] font-bold text-slate-800 block">Cole os contatos (Um por linha: Nome, Telefone)</label>
                      <textarea
                        rows={3}
                        placeholder={`Carlos, 11999998888\nMariana, 11988887777`}
                        value={pastedContacts}
                        onChange={(e) => setPastedContacts(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={handleImportPastedContacts}
                        disabled={isImporting}
                        className="btn-domu-primary text-xs py-1.5 px-3 w-full justify-center"
                      >
                        {isImporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        <span>Salvar no Banco e Usar nos Disparos</span>
                      </button>
                    </div>
                  )}

                  {/* Mode Options */}
                  <div className="space-y-2">
                    <label 
                      onClick={() => setSelectedSendMode('ALL')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedSendMode === 'ALL' ? 'border-domu-blue bg-blue-50/50 ring-1 ring-domu-blue' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="sendMode" 
                          checked={selectedSendMode === 'ALL'} 
                          onChange={() => setSelectedSendMode('ALL')}
                          className="text-domu-blue focus:ring-domu-blue"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Enviar para Todos os Contatos Salvos</p>
                          <p className="text-[11px] text-slate-500">Base total armazenada no Supabase</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-domu-blue text-white">
                        {contacts.length > 0 ? `${contacts.length} Contatos` : 'Todos'}
                      </span>
                    </label>

                    <label 
                      onClick={() => setSelectedSendMode('CUSTOM')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedSendMode === 'CUSTOM' ? 'border-domu-blue bg-blue-50/50 ring-1 ring-domu-blue' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="sendMode" 
                          checked={selectedSendMode === 'CUSTOM'} 
                          onChange={() => setSelectedSendMode('CUSTOM')}
                          className="text-domu-blue focus:ring-domu-blue"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Especificar Lote / Quantidade Personalizada</p>
                          <p className="text-[11px] text-slate-500">Defina o limite de envio para este lote</p>
                        </div>
                      </div>
                      
                      {selectedSendMode === 'CUSTOM' ? (
                        <input
                          type="number"
                          value={customQuantity}
                          onChange={(e) => setCustomQuantity(Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white font-bold text-center"
                        />
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">Lote</span>
                      )}
                    </label>
                  </div>

                </div>

              </div>
            )}

            {/* Step 2: Mensagem & Preview */}
            {step === 2 && (
              <div className="space-y-4">
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Selecione um Template Meta Aprovado</label>
                  <select
                    value={selectedTemplateName}
                    onChange={(e) => {
                      setSelectedTemplateName(e.target.value);
                      const t = templates.find(item => item.name === e.target.value);
                      if (t) setCustomMessage(t.body_text);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.name}>
                        {tpl.name} ({tpl.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Texto da Mensagem (com variáveis)</label>
                  <textarea
                    rows={4}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Exemplo de Nome para Teste de Preview</label>
                  <input
                    type="text"
                    value={variableName}
                    onChange={(e) => setVariableName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>

              </div>
            )}

          </div>

          {/* Right Live WhatsApp Preview Bubble (5 cols) */}
          <div className="lg:col-span-5 bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-domu-blue" />
                  Preview no WhatsApp
                </span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                  Visualização Real
                </span>
              </div>

              {/* WhatsApp Message Bubble */}
              <div className="bg-[#E5DDD5] p-3 rounded-xl border border-slate-300 shadow-inner min-h-[200px] flex flex-col justify-end">
                <div className="bg-white p-3.5 rounded-xl rounded-tl-none shadow-xs max-w-[90%] space-y-1">
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {getRenderedPreviewText()}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-1">
                    <span>14:32</span>
                    <span className="text-blue-500">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200 text-center">
              <p className="text-[11px] text-slate-600">
                Total estimado para este lote: <strong className="text-slate-900">{targetCount} contatos</strong>
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Voltar
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="btn-domu-primary text-xs py-2 px-4"
            >
              <span>Próximo Passo (Mensagem)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinishAndStart}
              className="btn-domu-primary text-xs py-2 px-4 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="w-4 h-4" />
              <span>Disparar Mensagens Agora</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
