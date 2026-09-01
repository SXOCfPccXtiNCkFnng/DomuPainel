'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Template } from '@/types';
import WhatsAppPreview, { renderTemplateVariables } from '@/components/shared/WhatsAppPreview';

interface CriarTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (newTpl: Template) => void;
}

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30';

export default function CriarTemplateModal({ isOpen, onClose, onAddTemplate }: CriarTemplateModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [bodyText, setBodyText] = useState('Olá {{nome}}! Temos uma novidade especial para você. Gostaria de saber mais detalhes?');
  const [variables, setVariables] = useState('nome');
  const [previewTestName, setPreviewTestName] = useState('Carlos Eduardo');
  const [companyName, setCompanyName] = useState('Sua Empresa');

  useEffect(() => {
    const saved = localStorage.getItem('domu_company_name');
    if (saved) setCompanyName(saved);
  }, []);

  if (!isOpen) return null;

  const handleInsertVariable = (varName: string) => {
    setBodyText((prev) => `${prev} {{${varName}}}`);
    if (!variables.includes(varName)) {
      setVariables((prev) => (prev ? `${prev}, ${varName}` : varName));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedName = (name || 'meu_template_personalizado')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    onAddTemplate({
      id: `tpl-${Date.now()}`,
      name: formattedName,
      category,
      language: 'pt_BR',
      status: 'APPROVED',
      bodyText,
      variables: variables.split(',').map((v) => v.trim()).filter(Boolean),
    });
    onClose();
  };

  const previewText = renderTemplateVariables(bodyText, {
    nome: previewTestName,
    produto: 'Oferta Especial',
    valor: 'R$ 299,00',
    empresa: companyName,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Criar Template</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Monte sua mensagem e visualize em tempo real</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">

          <div className="lg:col-span-7 p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100">

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Nome do template</label>
              <input
                type="text"
                required
                placeholder="ex: promocao_verao_2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'MARKETING' | 'UTILITY')}
                className={inputClass}
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidade</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600">Texto da mensagem</label>
                <div className="flex gap-1">
                  {['nome', 'produto', 'valor'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-domu-blue hover:bg-blue-50 border border-slate-200"
                    >
                      +{`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={5}
                required
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className={`${inputClass} leading-relaxed`}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Nome de teste no preview</label>
              <input
                type="text"
                value={previewTestName}
                onChange={(e) => setPreviewTestName(e.target.value)}
                placeholder="ex: Carlos Eduardo"
                className={inputClass}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-domu-primary text-xs py-2 px-5">
                <Plus className="w-3.5 h-3.5" />
                Salvar template
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 bg-slate-50/80">
            <WhatsAppPreview
              bodyText={previewText}
              contactName={companyName}
              companyLabel="Atendimento Oficial"
              buttonText={category === 'MARKETING' ? 'Saiba Mais' : undefined}
              footer={
                <p className="text-[11px] text-slate-500">
                  O preview atualiza conforme você edita o texto.
                </p>
              }
            />
          </div>

        </form>
      </div>
    </div>
  );
}
