'use client';

import React from 'react';
import { Building2, Send, Users, ArrowUpRight, MapPin, Plus } from 'lucide-react';
import { mockProperties } from '@/lib/mockData';
import { Property } from '@/types';
import Link from 'next/link';

interface ImoveisDestaqueProps {
  properties?: Property[];
  onTriggerPropertyDispatch?: (propertyTitle: string) => void;
  onOpenAddPropertyModal?: () => void;
}

export default function ImoveisDestaque({ properties = mockProperties, onTriggerPropertyDispatch, onOpenAddPropertyModal }: ImoveisDestaqueProps) {
  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-5 space-y-4 shadow-sm w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-domu-blue" />
            Catálogo de Imóveis & Automação de Alertas
          </h3>
          <p className="text-[11px] text-slate-500">
            Cadastre imóveis manualmente ou conecte seu sistema para disparar alertas para compradores interessados
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddPropertyModal && (
            <button
              onClick={onOpenAddPropertyModal}
              className="btn-domu-primary text-xs py-1.5 px-3 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Imóvel</span>
            </button>
          )}

          <Link 
            href="/imoveis" 
            className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1"
          >
            Ver Todos ({properties.length}) <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {properties.map((prop) => (
          <div 
            key={prop.id}
            className="rounded bg-white border border-slate-200/80 overflow-hidden hover:border-domu-blue/60 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            {/* Image & Badge Header */}
            <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
              <img 
                src={prop.imageUrl} 
                alt={prop.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-slate-900 text-white shadow-xs">
                  {prop.code}
                </span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-domu-blue text-white shadow-xs">
                  {prop.status}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">{prop.title}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-domu-blue" />
                  {prop.neighborhood}, {prop.city}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Valor</span>
                  <span className="font-extrabold text-slate-900 text-xs">
                    R$ {prop.price.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Leads Filtros</span>
                  <span className="font-black text-domu-blue flex items-center justify-end gap-1 text-xs">
                    <Users className="w-3.5 h-3.5" />
                    {prop.filteredLeadsCount} pessoas
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {onTriggerPropertyDispatch && (
                <button
                  onClick={() => onTriggerPropertyDispatch(prop.title)}
                  className="w-full mt-2 py-1.5 px-3 rounded bg-blue-50 hover:bg-domu-blue text-domu-blue hover:text-white border border-blue-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Disparar Alerta WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
