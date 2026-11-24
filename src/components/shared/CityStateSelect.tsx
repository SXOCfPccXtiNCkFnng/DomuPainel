'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, ChevronDown, Check, X } from 'lucide-react';
import { validateCityState } from '@/lib/onboardingValidation';

import { POPULAR_CITIES, searchCities, type CityStateOption } from '@/lib/cities';

export { POPULAR_CITIES, searchCities, type CityStateOption };

interface CityStateSelectProps {
  value: string;
  onChange: (formattedValue: string) => void;
  error?: string;
}

export function CityStateSelect({ value, onChange, error }: CityStateSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // On blur/outside click, validate query if user typed something custom
        if (query) {
          const check = validateCityState(query);
          if (check.ok) {
            onChange(check.formatted);
            setQuery(check.formatted);
          }
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, onChange]);

  const filteredOptions = searchCities(query, 12);

  const handleSelectOption = (opt: CityStateOption) => {
    onChange(opt.label);
    setQuery(opt.label);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <MapPin className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className={`w-full pl-10 pr-16 py-3 border bg-white text-slate-900 text-base placeholder-slate-400 focus:outline-none transition-colors ${
            error
              ? 'border-red-400 bg-red-50/10 focus:border-red-500 focus:ring-1 focus:ring-red-300'
              : value
                ? 'border-emerald-400/80 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30'
                : 'border-slate-200 focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30'
          }`}
          placeholder="Busque sua cidade (ex: São Paulo, SP ou Curitiba)"
          autoComplete="off"
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>Cidades em Destaque</span>
            <span className="text-[10px] font-normal text-slate-400 lowercase">digite para filtrar</span>
          </div>

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = value.toLowerCase() === opt.label.toLowerCase();
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSelectOption(opt)}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-blue-50/80 transition-colors ${
                    isSelected ? 'bg-blue-50 font-semibold text-domu-blue' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-domu-blue' : 'text-slate-400'}`} />
                    <span>{opt.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200">
                      {opt.uf}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-domu-blue" />}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-600 font-medium">Nenhuma cidade pré-cadastrada encontrada</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Pressione Enter ou clique fora para usar &quot;{query}&quot; (Formato: Cidade, UF).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
