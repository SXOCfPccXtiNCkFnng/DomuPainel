'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Plus, 
  Sparkles, 
  Check, 
  Info, 
  ShieldCheck, 
  Clock, 
  X,
  Send,
  RefreshCw
} from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Form State
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [bodyText, setBodyText] = useState('Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva da nossa empresa.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/templates?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success) {
        setTemplates(json.templates || []);
      }
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !bodyText) return;

    setIsSubmitting(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          name: templateName,
          category,
          bodyText
        })
      });
      const json = await res.json();

      if (json.success) {
        setTemplates([json.template, ...templates]);
        setIsModalOpen(false);
        setTemplateName('');
        setBodyText('');
      }
    } catch (err) {
      console.error('Erro ao criar template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 w-full font-sans">
      
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Templates de Mensagens
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
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Atualizar lista"
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

      {/* Meta Official Cloud API Notice Card */}
      <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-700">
        <ShieldCheck className="w-5 h-5 text-domu-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-900">Regras Oficiais da Meta Cloud API (HSM)</h4>
          <p className="text-slate-600 leading-relaxed">
            Para garantir a entrega de disparos no WhatsApp sem bloqueios, a Meta exige que toda mensagem iniciada pela empresa utilize um <strong>Template HSM pré-aprovado</strong> nas categorias <em>MARKETING</em> ou <em>UTILITY</em>. Variáveis são marcadas entre chaves duplas como <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-domu-blue">{"{{nome}}"}</code>.
          </p>
        </div>
      </div>

      {/* Templates List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {templates.map((tpl) => (
          <div 
            key={tpl.id} 
            className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-domu-blue" />
                  <span className="font-bold text-xs text-slate-900 font-mono">{tpl.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> APROVADO
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                  {tpl.category}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Português (BR)</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-700 leading-relaxed font-sans">
                "{tpl.body_text}"
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Variáveis: {tpl.variables?.join(', ') || 'nome'}</span>
              <button 
                onClick={() => handleCopy(tpl.id)}
                className="text-domu-blue font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : 'Pronto p/ Disparo'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Criar & Submeter Novo Template Meta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Novo Template HSM para Aprovação Meta</h3>
                <p className="text-xs text-slate-500">Cadastre um modelo oficial para disparos em massa</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nome do Template (sem espaços, ex: aviso_promocao)</label>
                <input
                  type="text"
                  required
                  placeholder="ex: aviso_promocao_especial"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Categoria Meta</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                >
                  <option value="MARKETING">MARKETING (Ofertas, Promoções, Lançamentos)</option>
                  <option value="UTILITY">UTILITY (Avisos, Lembretes, Confirmações)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Texto da Mensagem (use {"{{nome}}"} para personalizar)</label>
                <textarea
                  rows={4}
                  required
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Olá {{nome}}! Temos uma super novidade para você hoje."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                📌 Ao clicar em salvar, o modelo é registrado no Supabase com validação e pronto para uso nos disparos.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Salvar Template</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
