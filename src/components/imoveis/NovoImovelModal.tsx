'use client';

import React, { useState } from 'react';
import { X, Building2, Plus, Image as ImageIcon, MapPin, DollarSign, CheckCircle2 } from 'lucide-react';
import { Property } from '@/types';

interface NovoImovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProperty: (newProp: Property) => void;
}

export default function NovoImovelModal({ isOpen, onClose, onAddProperty }: NovoImovelModalProps) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(`DOM-${Math.floor(100 + Math.random() * 900)}`);
  const [status, setStatus] = useState<'Lançamento' | 'Disponível' | 'Vendido'>('Lançamento');
  const [price, setPrice] = useState('750000');
  const [neighborhood, setNeighborhood] = useState('Jardim Botânico');
  const [city, setCity] = useState('Ribeirão Preto');
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80');
  const [filteredLeadsCount, setFilteredLeadsCount] = useState('115');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const createdProp: Property = {
      id: `prop-${Date.now()}`,
      title: title || 'Novo Empreendimento Imobiliário',
      code: code || 'DOM-999',
      status,
      price: parseFloat(price) || 500000,
      neighborhood: neighborhood || 'Centro',
      city: city || 'Ribeirão Preto',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      filteredLeadsCount: parseInt(filteredLeadsCount, 10) || 85
    };

    onAddProperty(createdProp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-domu-blue/10 text-domu-blue flex items-center justify-center border border-domu-blue/20">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Cadastrar Novo Imóvel</h3>
              <p className="text-[11px] text-slate-500 font-medium">Cadastre imóveis manualmente sem precisar de integração</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">Título / Nome do Imóvel *</label>
            <input 
              type="text"
              required
              placeholder="Ex: Residencial Park Boulevard - 3 Suítes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-domu-blue font-medium"
            />
          </div>

          {/* Grid: Code & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Código / Referência</label>
              <input 
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold focus:outline-none focus:border-domu-blue"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Status do Imóvel</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-domu-blue"
              >
                <option value="Lançamento">Lançamento</option>
                <option value="Disponível">Disponível</option>
                <option value="Vendido">Vendido</option>
              </select>
            </div>
          </div>

          {/* Grid: Price & Neighborhood */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Valor R$</label>
              <input 
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-domu-blue"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Bairro</label>
              <input 
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium focus:outline-none focus:border-domu-blue"
              />
            </div>
          </div>

          {/* Preset Photos Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Selecione uma Foto Demonstrativa</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setImageUrl('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80')}
                className={`relative h-16 rounded overflow-hidden border-2 transition-all ${
                  imageUrl.includes('photo-1600585154340') ? 'border-domu-blue ring-2 ring-blue-200' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" alt="Casa" className="w-full h-full object-cover" />
              </button>

              <button
                type="button"
                onClick={() => setImageUrl('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80')}
                className={`relative h-16 rounded overflow-hidden border-2 transition-all ${
                  imageUrl.includes('photo-1545324418') ? 'border-domu-blue ring-2 ring-blue-200' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" alt="Apartamento" className="w-full h-full object-cover" />
              </button>

              <button
                type="button"
                onClick={() => setImageUrl('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80')}
                className={`relative h-16 rounded overflow-hidden border-2 transition-all ${
                  imageUrl.includes('photo-1600607687939') ? 'border-domu-blue ring-2 ring-blue-200' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80" alt="Luxo" className="w-full h-full object-cover" />
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
              <span>Salvar Imóvel no Painel</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
