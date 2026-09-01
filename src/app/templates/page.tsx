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
  X,
  ImageIcon,
  Eye,
  Smartphone,
  Lock
} from 'lucide-react';

export default function TemplatesPage() {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Template Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [headerType, setHeaderType] = useState<'NONE' | 'IMAGE'>('NONE');
  const [headerContent, setHeaderContent] = useState('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80');
  const [bodyText, setBodyText] = useState('Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva da nossa empresa. Podemos conversar?');
  const [previewTestName, setPreviewTestName] = useState('Carlos Eduardo');
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
          headerType,
          headerContent: headerType === 'IMAGE' ? headerContent : null,
          language: 'pt_BR',
          bodyText
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setName('');
        setBodyText('Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva da nossa empresa. Podemos conversar?');
        setHeaderType('NONE');
        fetchTemplates();
      }
    } catch (err) {
      console.error('Erro ao criar template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLivePreviewText = () => {
    if (!bodyText.trim()) return 'Digite o texto da mensagem no formulário para visualizar o resultado...';
    let text = bodyText;
    text = text.replace(/\{\{nome\}\}/g, previewTestName || 'Cliente');
    text = text.replace(/\{\{horario\}\}/g, '15:00');
    return text;
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
            Para garantir a entrega de disparos no WhatsApp sem bloqueios, a Meta exige que toda mensagem iniciada pela empresa utilize um <strong>Template HSM pré-aprovado</strong> nas categorias <em>MARKETING</em> ou <em>UTILITY</em>. Você pode cadastrar modelos com Imagem de Destaque ou apenas texto. Variáveis são marcadas entre chaves duplas como <code className="font-mono text-domu-blue bg-white px-1.5 py-0.5 rounded border border-blue-200">{"{{nome}}"}</code>.
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.map((tpl) => {
          const isApproved = tpl.status === 'APPROVED';
          const hasImage = tpl.header_type === 'IMAGE' || Boolean(tpl.header_content);

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

                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-500 uppercase">
                  <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{tpl.category}</span>
                  {tpl.is_global !== false ? (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-extrabold">
                      🌐 PADRÃO DOMU
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-extrabold">
                      🏢 MINHA EMPRESA
                    </span>
                  )}
                  {hasImage && (
                    <span className="px-2 py-0.5 bg-blue-100 text-domu-blue rounded flex items-center gap-1 font-black">
                      <ImageIcon className="w-3 h-3" />
                      COM IMAGEM
                    </span>
                  )}
                </div>

                {/* Optional Image Thumbnail Preview */}
                {hasImage && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-100 relative">
                    <img 
                      src={tpl.header_content || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'} 
                      alt="Template Preview Image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

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

      {/* Modal: Criar Novo Template Meta com Live WhatsApp Preview de 2 Colunas */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Novo Template HSM para Aprovação Meta</h3>
                <p className="text-xs text-slate-500">Cadastre o modelo e veja a simulação ao vivo antes de enviar para aprovação</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2-Column Grid: Form Inputs (Left) & Real-Time WhatsApp Live Preview (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 overflow-y-auto flex-1 p-1">
              
              {/* Left Column: Form Fields (7 cols) */}
              <form onSubmit={handleCreateTemplate} id="create-tpl-form" className="lg:col-span-7 space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nome do Template (sem espaços, ex: aviso_promocao)</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: lancamento_promocao_especial"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Categoria Meta</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white font-bold"
                    >
                      <option value="MARKETING">MARKETING (Ofertas)</option>
                      <option value="UTILITY">UTILITY (Atendimento)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Formato do Cabeçalho</label>
                    <select
                      value={headerType}
                      onChange={(e) => setHeaderType(e.target.value as any)}
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 bg-white font-bold"
                    >
                      <option value="NONE">Apenas Texto</option>
                      <option value="IMAGE">Imagem de Destaque (Banner)</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Image URL Input */}
                {headerType === 'IMAGE' && (
                  <div className="space-y-1.5 p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-domu-blue" />
                      <span>URL da Imagem de Exemplo (Foto do Lançamento/Banner)</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                      placeholder="https://suaempresa.com/banner.jpg"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-mono"
                    />
                    <p className="text-[11px] text-slate-500">
                      Insira o link direto da imagem JPG/PNG do seu anúncio ou banner promocional.
                    </p>
                  </div>
                )}

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

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nome de Teste p/ Preview ao Vivo</label>
                  <input
                    type="text"
                    value={previewTestName}
                    onChange={(e) => setPreviewTestName(e.target.value)}
                    placeholder="ex: Carlos Eduardo"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-bold"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                  📌 Ao clicar em salvar, o modelo é registrado na sua conta e disponibilizado para aprovação da Meta.
                </div>

              </form>

              {/* Right Column: Live Real-Time WhatsApp Device Simulator (5 cols) */}
              <div className="lg:col-span-5 bg-gradient-to-b from-slate-100 to-slate-200/80 p-4 rounded-3xl border border-slate-300 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-domu-blue" />
                      Preview no WhatsApp (Ao Vivo)
                    </span>
                    <span className="text-[10px] text-emerald-700 font-black bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Simulação Real
                    </span>
                  </div>

                  {/* Realistic WhatsApp Chat Device Bar */}
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

                  {/* Authentic WhatsApp Message Box Body */}
                  <div className="bg-[#E5DDD5] p-3.5 rounded-b-2xl border border-t-0 border-slate-300 shadow-inner min-h-[240px] flex flex-col justify-end">
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden space-y-2">
                      
                      {/* Live Image Banner if IMAGE Header selected */}
                      {headerType === 'IMAGE' && (
                        <div className="w-full h-36 bg-slate-100 relative overflow-hidden border-b border-slate-100">
                          <img 
                            src={headerContent || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'} 
                            alt="Preview do Banner"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="p-3 space-y-1.5">
                        <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
                          {getLivePreviewText()}
                        </p>

                        <div className="flex items-center justify-end gap-1 text-[9.5px] text-slate-400 pt-0.5 font-sans">
                          <span>14:32</span>
                          <span className="text-blue-500 font-black tracking-tighter">✓✓</span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                <p className="text-[11px] text-slate-500 text-center pt-2">
                  Esta simulação mostra como seu cliente visualizará a mensagem oficial no aplicativo do WhatsApp.
                </p>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="create-tpl-form"
                disabled={isSubmitting}
                className="btn-domu-primary text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>Enviar para Aprovação Meta</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
