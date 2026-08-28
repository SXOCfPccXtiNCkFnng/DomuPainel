'use client';

import React, { useState } from 'react';
import CriarTemplateModal from '@/components/templates/CriarTemplateModal';
import { FileCode, Plus, CheckCircle2, ShieldCheck, Sparkles, Copy, Eye, MessageSquare } from 'lucide-react';
import { mockTemplates } from '@/lib/mockData';
import { Template } from '@/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const handleAddTemplate = (newTpl: Template) => {
    setTemplates([newTpl, ...templates]);
    setSuccessNotification(`Template "${newTpl.name}" criado com sucesso e pronto para uso em disparos!`);
    setTimeout(() => setSuccessNotification(null), 5000);
  };

  return (
    <div className="space-y-6 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200">
              Templates de Mensagens
            </span>
            <span className="text-xs text-slate-500 font-medium">Meta Cloud API v20.0</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Modelos de Mensagem do WhatsApp
          </h1>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-domu-primary text-xs py-2 px-4 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Template</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successNotification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-md flex items-center justify-between text-xs font-bold shadow-xs animate-in fade-in duration-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successNotification}
          </span>
          <button 
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 underline text-[11px]"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {templates.map((tpl) => (
          <div 
            key={tpl.id} 
            className="bg-white rounded-md border border-slate-200/80 p-4 shadow-sm hover:border-domu-blue/60 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-domu-blue" />
                  <span className="font-mono font-bold text-xs text-slate-900">{tpl.name}</span>
                </div>

                <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Aprovado
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10.5px]">
                <span className="bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-600">
                  {tpl.category}
                </span>
                <span className="text-slate-400 font-mono">{tpl.language}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200/60 text-xs text-slate-700 leading-relaxed font-medium">
                "{tpl.bodyText}"
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">
                Variáveis: <strong>{tpl.variables.join(', ')}</strong>
              </span>

              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pronto p/ Disparo
              </span>
            </div>

          </div>
        ))}
      </div>

      {/* Modal de Criacao de Template */}
      <CriarTemplateModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTemplate={handleAddTemplate}
      />

    </div>
  );
}
