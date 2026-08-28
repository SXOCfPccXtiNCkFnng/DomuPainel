'use client';

import React, { useState } from 'react';
import { X, Send, Eye, ShieldCheck, FileCode, ChevronRight } from 'lucide-react';
import { mockTemplates } from '@/lib/mockData';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCampaign: (title: string, templateName: string, count: number) => void;
  initialPropertyTitle?: string;
}

export default function CampaignWizardModal({
  isOpen,
  onClose,
  onStartCampaign,
  initialPropertyTitle
}: CampaignWizardModalProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(initialPropertyTitle ? `Alerta WhatsApp - ${initialPropertyTitle}` : 'Nova Campanha de Lançamento');
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-1');
  const [audienceFilter, setAudienceFilter] = useState('COMPRADORES_APARTAMENTO');
  const [variableValues, setVariableValues] = useState({
    nome: 'Carlos Eduardo',
    imovel: initialPropertyTitle || 'Horizon Tower - 3 Suítes',
    bairro: 'Alto da Boa Vista',
    valor: '890.000'
  });

  if (!isOpen) return null;

  const selectedTemplate = mockTemplates.find(t => t.id === selectedTemplateId) || mockTemplates[0];

  const getRenderedPreviewText = () => {
    let text = selectedTemplate.bodyText;
    text = text.replace('{{nome}}', variableValues.nome);
    text = text.replace('{{imovel}}', variableValues.imovel);
    text = text.replace('{{bairro}}', variableValues.bairro);
    text = text.replace('{{valor}}', variableValues.valor);
    text = text.replace('{{horario}}', '15:00');
    text = text.replace('{{corretor}}', 'Lucas Silva');
    return text;
  };

  const handleFinishAndStart = () => {
    onStartCampaign(title, selectedTemplate.name, 142);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-domu-blue text-white flex items-center justify-center shadow-sm">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Assistente de Disparo em Massa</h3>
              <p className="text-[11px] text-slate-500">Conexão Oficial Meta Cloud API • Anti-Ban Ativo</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps Bar */}
        <div className="px-6 py-2.5 bg-domu-navy text-white flex items-center justify-between text-xs font-semibold border-b border-slate-800">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-domu-blue font-bold' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-domu-blue text-white' : 'bg-slate-800'}`}>1</span>
            Público Imobiliário
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-domu-blue font-bold' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-domu-blue text-white' : 'bg-slate-800'}`}>2</span>
            Template Meta HSM
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-domu-blue font-bold' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-domu-blue text-white' : 'bg-slate-800'}`}>3</span>
            Preview & Disparo
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Configuration Form (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Título da Campanha</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-domu-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Filtro de Segmento Imobiliário</label>
                  <div className="space-y-2">
                    <label className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      audienceFilter === 'COMPRADORES_APARTAMENTO' ? 'border-domu-blue bg-blue-50/50 shadow-sm' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio" 
                          name="audience" 
                          checked={audienceFilter === 'COMPRADORES_APARTAMENTO'} 
                          onChange={() => setAudienceFilter('COMPRADORES_APARTAMENTO')}
                          className="text-domu-blue focus:ring-domu-blue"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Interessados em Apartamentos (3 Suítes)</p>
                          <p className="text-[11px] text-slate-500">Leads cadastrados nos últimos 60 dias • R$ 800k - R$ 1.2M</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-domu-blue text-white">142 Leads</span>
                    </label>

                    <label className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      audienceFilter === 'INVESTIDORES' ? 'border-domu-blue bg-blue-50/50 shadow-sm' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio" 
                          name="audience" 
                          checked={audienceFilter === 'INVESTIDORES'} 
                          onChange={() => setAudienceFilter('INVESTIDORES')}
                          className="text-domu-blue focus:ring-domu-blue"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Investidores de Lançamentos</p>
                          <p className="text-[11px] text-slate-500">Foco em Studios e Rentabilidade de Aluguel</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">215 Leads</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">Selecione o Template Aprovado pela Meta (HSM)</label>
                <div className="space-y-2.5">
                  {mockTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        selectedTemplateId === tpl.id 
                          ? 'border-domu-blue bg-blue-50/40 ring-1 ring-domu-blue' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-domu-blue flex items-center gap-1">
                          <FileCode className="w-3.5 h-3.5" />
                          {tpl.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700">
                          {tpl.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">{tpl.bodyText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-slate-900 text-white p-3.5 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-domu-blue">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-bold">Proteção Anti-Ban Meta Ativa</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    O disparo utilizará a infraestrutura oficial da <strong>Cloud API com Coexistência</strong>. O envio será rate-limited (lotes inteligentes) para evitar picos.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Substituição das Variáveis</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Nome do Imóvel</label>
                      <input 
                        type="text" 
                        value={variableValues.imovel} 
                        onChange={(e) => setVariableValues({...variableValues, imovel: e.target.value})}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Valor (R$)</label>
                      <input 
                        type="text" 
                        value={variableValues.valor} 
                        onChange={(e) => setVariableValues({...variableValues, valor: e.target.value})}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Live WhatsApp Preview Bubble (5 cols) */}
          <div className="lg:col-span-5 bg-slate-100 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
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

              {/* WhatsApp Mock Screen */}
              <div className="bg-[#E5DDD5] p-3 rounded-lg border border-slate-300 shadow-inner min-h-[200px] flex flex-col justify-end">
                <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[88%] space-y-1">
                  <span className="text-[10px] font-bold text-domu-blue block">Imobiliária Prime Living</span>
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
              <p className="text-[11px] text-slate-500">
                Disparo estimado: <strong className="text-slate-900">142 contatos</strong> • Tempo estimado: <strong className="text-domu-blue">~1 min 10s</strong>
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            Voltar
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-domu-primary text-xs"
            >
              <span>Próximo Passo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinishAndStart}
              className="btn-domu-primary text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="w-4 h-4" />
              <span>Iniciar Disparo na Fila</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
