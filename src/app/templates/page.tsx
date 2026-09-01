'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw,
  Search,
  Sparkles,
  Info,
  X
} from 'lucide-react';

export default function TemplatesPage() {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Template Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [bodyText, setBodyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/templates?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.templates) {
        setTemplates(json.templates);
      }
    } catch (err) {
      console.error('Erro ao buscar templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    setIsSubmitting(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          category,
          language: 'pt_BR',
          bodyText
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setName('');
        setBodyText('');
        fetchTemplates();
      }
    } catch (err) {
      console.error('Erro ao criar template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'APPROVED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          APROVADO META
        </span>
      );
    } else if (status === 'PENDING') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
          EM ANÁLISE META
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          REJEITADO META
        </span>
      );
    }
  };

  return (
    <div className="space-y-6 w-full font-sans">
      
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              TEMPLATES DE MENSAGENS
            </span>
            <span className="text-xs text-slate-500 font-medium">Padrão Meta Cloud API v20.0</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Modelos de Mensagem do WhatsApp (HSM)
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemplates}
            className="p-2 bg-white text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Atualizar lista com a Meta"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Template Meta</span>
          </button>
        </div>
      </div>

      {/* Official Meta Regulations Banner */}
      <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200/90 text-xs text-slate-700 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-domu-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-900">Regras Oficiais da Meta Cloud API (HSM)</h4>
          <p className="text-[11.5px] leading-relaxed text-slate-600">
            Para garantir a entrega de disparos no WhatsApp sem bloqueios, a Meta exige que toda mensagem iniciada pela empresa utilize um <strong>Template HSM pré-aprovado</strong> nas categorias <em>MARKETING</em> ou <em>UTILITY</em>. Variáveis são marcadas entre chaves duplas como <code className="font-mono text-domu-blue bg-white px-1.5 py-0.5 rounded border border-blue-200">{"{{nome}}"}</code>.
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((tpl) => {
          const isApproved = tpl.status === 'APPROVED';

          return (
            <div 
              key={tpl.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                isApproved ? 'border-slate-200/90 hover:border-blue-300 hover:shadow-md' : 'border-amber-200/80 bg-amber-50/20'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-domu-blue" />
                    <h3 className="text-xs font-black text-slate-900 font-mono tracking-tight">{tpl.name}</h3>
                  </div>
                  {renderStatusBadge(tpl.status)}
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{tpl.category}</span>
                  <span>Português (BR)</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans min-h-[75px]">
                  "{tpl.body_text}"
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3 text-xs">
                <span className="text-[11px] text-slate-400 font-medium">
                  Variáveis: {tpl.variables?.join(', ') || 'nome'}
                </span>

                {isApproved ? (
                  <span className="text-domu-blue font-extrabold flex items-center gap-1">
                    Pronto p/ Disparo
                  </span>
                ) : (
                  <span className="text-amber-700 font-extrabold text-[11px]">
                    Aguardando Meta
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Criar Novo Template Meta (Fixed Full Overlay Backdrop via Portal) */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Novo Template HSM para Aprovação Meta</h3>
                <p className="text-xs text-slate-500">Cadastre um modelo oficial para disparos em massa</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nome do Template (sem espaços, ex: aviso_promocao)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: aviso_promocao_especial"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Categoria Meta</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white font-bold"
                >
                  <option value="MARKETING">MARKETING (Ofertas, Promoções, Lançamentos)</option>
                  <option value="UTILITY">UTILITY (Notificações, Lembretes de Atendimento)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Texto da Mensagem (use {"{{nome}}"} para personalizar)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva da nossa empresa."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                📌 Ao clicar em salvar, o modelo é registrado na sua conta e disponibilizado para aprovação da Meta.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>Salvar Template</span>
                </button>
              </div>

            </form>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
