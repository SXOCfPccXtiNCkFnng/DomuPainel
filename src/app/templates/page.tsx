'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WhatsAppPreview, { renderTemplateVariables } from '@/components/shared/WhatsAppPreview';
import ImageSourceField from '@/components/shared/ImageSourceField';
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
  Lock,
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
  const [headerContent, setHeaderContent] = useState('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80');
  const [bodyText, setBodyText] = useState('Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva da nossa empresa. Podemos conversar?');
  const [previewTestName, setPreviewTestName] = useState('Carlos Eduardo');
  const [companyName, setCompanyName] = useState('Sua Empresa');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('domu_company_name');
    if (saved) setCompanyName(saved);
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
    return renderTemplateVariables(bodyText, {
      nome: previewTestName || 'Cliente',
      horario: '15:00',
      produto: 'Oferta Especial',
      valor: 'R$ 299,00',
    });
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
            className="p-2 bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
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
      <div className="p-4 bg-blue-50 border border-blue-200 text-xs text-slate-700 flex items-start gap-3">
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
              className={`bg-white border p-5 flex flex-col justify-between transition-all ${
                isApproved ? 'border-slate-200 hover:border-domu-blue/40' : 'border-amber-200 bg-amber-50/20'
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
                      PADRÃO DOMU
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
                  <div className="overflow-hidden border border-slate-200 h-28 bg-slate-100 relative">
                    <img 
                      src={tpl.header_content || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80'} 
                      alt="Template Preview Image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-3.5 bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans min-h-[75px]">
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
        <div className="fixed inset-0 z-[99999] bg-slate-900/50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">

            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Novo Template HSM</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Cadastre o modelo e visualize antes de enviar à Meta</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">

              <form onSubmit={handleCreateTemplate} id="create-tpl-form" className="lg:col-span-7 p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Nome do template</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: aviso_promocao_verao"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Categoria</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as 'MARKETING' | 'UTILITY')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utilidade</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Cabeçalho</label>
                    <select
                      value={headerType}
                      onChange={(e) => setHeaderType(e.target.value as 'NONE' | 'IMAGE')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                    >
                      <option value="NONE">Apenas texto</option>
                      <option value="IMAGE">Com imagem</option>
                    </select>
                  </div>
                </div>

                {headerType === 'IMAGE' && (
                  <ImageSourceField
                    value={headerContent}
                    onChange={setHeaderContent}
                    label="Imagem do banner (exemplo para aprovação Meta)"
                    hint="Imagem de exemplo enviada à Meta na aprovação do template. Em cada disparo você poderá trocar por outra URL ou upload."
                    required
                  />
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                    Texto da mensagem
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Olá {{nome}}! Gostaria de apresentar uma oferta exclusiva."
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Nome de teste no preview</label>
                  <input
                    type="text"
                    value={previewTestName}
                    onChange={(e) => setPreviewTestName(e.target.value)}
                    placeholder="ex: Carlos Eduardo"
                    className="w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
                  />
                </div>

                <p className="text-[11px] text-slate-500 border-l-2 border-slate-300 pl-3">
                  Ao salvar, o modelo é registrado e enviado para aprovação da Meta.
                </p>

              </form>

              <div className="lg:col-span-5 p-6 bg-slate-50/80">
                <WhatsAppPreview
                  bodyText={getLivePreviewText()}
                  showImage={headerType === 'IMAGE'}
                  imageUrl={headerContent}
                  contactName={companyName}
                  companyLabel="Atendimento Oficial"
                  buttonText={category === 'MARKETING' ? 'Saiba Mais' : undefined}
                  footer={
                    <p className="text-[11px] text-slate-500">
                      Simulação de como o cliente verá a mensagem.
                    </p>
                  }
                />
              </div>

            </div>

            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="create-tpl-form"
                disabled={isSubmitting}
                className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-1.5"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Enviar para aprovação
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
