'use client';

import React, { useState } from 'react';
import { X, FileCode, Plus, Sparkles, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { Template } from '@/types';

interface CriarTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (newTpl: Template) => void;
}

export default function CriarTemplateModal({ isOpen, onClose, onAddTemplate }: CriarTemplateModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [bodyText, setBodyText] = useState('Olá {{nome}}! Acabamos de liberar unidades exclusivas no imóvel {{imovel}} em {{bairro}}. Gostaria de agendar uma visita presencial esta semana?');
  const [variables, setVariables] = useState('nome, imovel, bairro');

  if (!isOpen) return null;

  const handleInsertVariable = (varName: string) => {
    setBodyText(prev => `${prev} {{${varName}}}`);
    if (!variables.includes(varName)) {
      setVariables(prev => prev ? `${prev}, ${varName}` : varName);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedName = (name || 'meu_template_personalizado')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const createdTemplate: Template = {
      id: `tpl-${Date.now()}`,
      name: formattedName,
      category,
      language: 'pt_BR',
      status: 'APPROVED',
      bodyText: bodyText,
      variables: variables.split(',').map(v => v.trim()).filter(Boolean)
    };

    onAddTemplate(createdTemplate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-domu-blue/10 text-domu-blue flex items-center justify-center border border-domu-blue/20">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Criar Novo Template do WhatsApp</h3>
              <p className="text-[11px] text-slate-500 font-medium">Monte sua própria mensagem com variáveis personalizadas</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body & Preview Grid */}
        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Left Form Controls (7 cols) */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Template Identifier Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Nome Identificador do Template *</label>
              <input 
                type="text"
                required
                placeholder="ex: lancamento_residencial_sul"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold focus:outline-none focus:border-domu-blue"
              />
              <p className="text-[10px] text-slate-400">Usado internamente pela Meta Cloud API (apenas letras minúsculas e underline)</p>
            </div>

            {/* Category Selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Categoria do Envio</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-domu-blue"
              >
                <option value="MARKETING">Marketing & Vendas (Lançamentos e Alertas)</option>
                <option value="UTILITY">Utilidade (Lembrete de Visita / Notificações)</option>
              </select>
            </div>

            {/* Body Text Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">Texto da Mensagem *</label>
                <span className="text-[10px] text-slate-400">Variáveis: &#123;&#123;nome&#125;&#125;</span>
              </div>

              {/* Variable Quick Insert Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">Atalhos:</span>
                <button
                  type="button"
                  onClick={() => handleInsertVariable('nome')}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-domu-blue text-[10.5px] font-bold border border-blue-200 transition-colors"
                >
                  + &#123;&#123;nome&#125;&#125;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertVariable('imovel')}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-domu-blue text-[10.5px] font-bold border border-blue-200 transition-colors"
                >
                  + &#123;&#123;imovel&#125;&#125;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertVariable('valor')}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-domu-blue text-[10.5px] font-bold border border-blue-200 transition-colors"
                >
                  + &#123;&#123;valor&#125;&#125;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertVariable('bairro')}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-domu-blue text-[10.5px] font-bold border border-blue-200 transition-colors"
                >
                  + &#123;&#123;bairro&#125;&#125;
                </button>
              </div>

              <textarea 
                rows={4}
                required
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-domu-blue font-medium leading-relaxed"
              ></textarea>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-domu-primary text-xs py-1.5 px-4 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Template</span>
              </button>
            </div>

          </div>

          {/* Right Live WhatsApp Card Preview (5 cols) */}
          <div className="md:col-span-5 space-y-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
              Preview do WhatsApp em Tempo Real
            </span>

            <div className="bg-[#E5DDD5]/30 p-3.5 rounded-lg border border-slate-200 space-y-2 min-h-[260px] flex flex-col justify-center">
              
              <div className="bg-white rounded-lg p-3 shadow-xs border border-slate-200/80 space-y-1.5">
                <span className="text-[9.5px] font-bold text-domu-blue block uppercase tracking-wider">
                  Meta Cloud API Approved
                </span>

                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {bodyText
                    .replace(/\{\{nome\}\}/g, 'Carlos Eduardo')
                    .replace(/\{\{imovel\}\}/g, 'Horizon Tower')
                    .replace(/\{\{valor\}\}/g, 'R$ 890.000')
                    .replace(/\{\{bairro\}\}/g, 'Alto da Boa Vista')}
                </p>

                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-1">
                  <span>14:30</span>
                  <CheckCircle2 className="w-3 h-3 text-domu-blue" />
                </div>
              </div>

              <div className="bg-white rounded p-2 text-center text-xs font-bold text-domu-blue border border-slate-200 cursor-pointer shadow-2xs">
                Falar com Corretor
              </div>

            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
