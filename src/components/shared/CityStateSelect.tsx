'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, ChevronDown, Check, X } from 'lucide-react';
import { validateCityState } from '@/lib/onboardingValidation';

export type CityStateOption = {
  city: string;
  uf: string;
  label: string; // "São Paulo, SP"
};

export const POPULAR_CITIES: CityStateOption[] = [
  // SP
  { city: 'São Paulo', uf: 'SP', label: 'São Paulo, SP' },
  { city: 'Campinas', uf: 'SP', label: 'Campinas, SP' },
  { city: 'Guarulhos', uf: 'SP', label: 'Guarulhos, SP' },
  { city: 'São Bernardo do Campo', uf: 'SP', label: 'São Bernardo do Campo, SP' },
  { city: 'Santo André', uf: 'SP', label: 'Santo André, SP' },
  { city: 'Osasco', uf: 'SP', label: 'Osasco, SP' },
  { city: 'Ribeirão Preto', uf: 'SP', label: 'Ribeirão Preto, SP' },
  { city: 'Sorocaba', uf: 'SP', label: 'Sorocaba, SP' },
  { city: 'Santos', uf: 'SP', label: 'Santos, SP' },
  { city: 'São José dos Campos', uf: 'SP', label: 'São José dos Campos, SP' },
  { city: 'Barueri', uf: 'SP', label: 'Barueri, SP' },
  { city: 'Jundiaí', uf: 'SP', label: 'Jundiaí, SP' },
  { city: 'Piracicaba', uf: 'SP', label: 'Piracicaba, SP' },
  { city: 'Bauru', uf: 'SP', label: 'Bauru, SP' },
  { city: 'Franca', uf: 'SP', label: 'Franca, SP' },
  { city: 'Presidente Prudente', uf: 'SP', label: 'Presidente Prudente, SP' },
  { city: 'Araraquara', uf: 'SP', label: 'Araraquara, SP' },
  { city: 'Taubaté', uf: 'SP', label: 'Taubaté, SP' },
  { city: 'Marília', uf: 'SP', label: 'Marília, SP' },
  { city: 'Americana', uf: 'SP', label: 'Americana, SP' },

  // RJ
  { city: 'Rio de Janeiro', uf: 'RJ', label: 'Rio de Janeiro, RJ' },
  { city: 'Niterói', uf: 'RJ', label: 'Niterói, RJ' },
  { city: 'Duque de Caxias', uf: 'RJ', label: 'Duque de Caxias, RJ' },
  { city: 'Nova Iguaçu', uf: 'RJ', label: 'Nova Iguaçu, RJ' },
  { city: 'São Gonçalo', uf: 'RJ', label: 'São Gonçalo, RJ' },
  { city: 'Petrópolis', uf: 'RJ', label: 'Petrópolis, RJ' },
  { city: 'Volta Redonda', uf: 'RJ', label: 'Volta Redonda, RJ' },
  { city: 'Campos dos Goytacazes', uf: 'RJ', label: 'Campos dos Goytacazes, RJ' },
  { city: 'Cabo Frio', uf: 'RJ', label: 'Cabo Frio, RJ' },
  { city: 'Macaé', uf: 'RJ', label: 'Macaé, RJ' },

  // MG
  { city: 'Belo Horizonte', uf: 'MG', label: 'Belo Horizonte, MG' },
  { city: 'Uberlândia', uf: 'MG', label: 'Uberlândia, MG' },
  { city: 'Juiz de Fora', uf: 'MG', label: 'Juiz de Fora, MG' },
  { city: 'Contagem', uf: 'MG', label: 'Contagem, MG' },
  { city: 'Betim', uf: 'MG', label: 'Betim, MG' },
  { city: 'Montes Claros', uf: 'MG', label: 'Montes Claros, MG' },
  { city: 'Uberaba', uf: 'MG', label: 'Uberaba, MG' },
  { city: 'Governador Valadares', uf: 'MG', label: 'Governador Valadares, MG' },
  { city: 'Ipatinga', uf: 'MG', label: 'Ipatinga, MG' },
  { city: 'Poços de Caldas', uf: 'MG', label: 'Poços de Caldas, MG' },

  // PR
  { city: 'Curitiba', uf: 'PR', label: 'Curitiba, PR' },
  { city: 'Londrina', uf: 'PR', label: 'Londrina, PR' },
  { city: 'Maringá', uf: 'PR', label: 'Maringá, PR' },
  { city: 'Ponta Grossa', uf: 'PR', label: 'Ponta Grossa, PR' },
  { city: 'Cascavel', uf: 'PR', label: 'Cascavel, PR' },
  { city: 'Foz do Iguaçu', uf: 'PR', label: 'Foz do Iguaçu, PR' },
  { city: 'São José dos Pinhais', uf: 'PR', label: 'São José dos Pinhais, PR' },

  // SC
  { city: 'Florianópolis', uf: 'SC', label: 'Florianópolis, SC' },
  { city: 'Joinville', uf: 'SC', label: 'Joinville, SC' },
  { city: 'Blumenau', uf: 'SC', label: 'Blumenau, SC' },
  { city: 'Chapecó', uf: 'SC', label: 'Chapecó, SC' },
  { city: 'Criciúma', uf: 'SC', label: 'Criciúma, SC' },
  { city: 'Itajaí', uf: 'SC', label: 'Itajaí, SC' },
  { city: 'Balneário Camboriú', uf: 'SC', label: 'Balneário Camboriú, SC' },

  // RS
  { city: 'Porto Alegre', uf: 'RS', label: 'Porto Alegre, RS' },
  { city: 'Caxias do Sul', uf: 'RS', label: 'Caxias do Sul, RS' },
  { city: 'Canoas', uf: 'RS', label: 'Canoas, RS' },
  { city: 'Pelotas', uf: 'RS', label: 'Pelotas, RS' },
  { city: 'Santa Maria', uf: 'RS', label: 'Santa Maria, RS' },
  { city: 'Gravataí', uf: 'RS', label: 'Gravataí, RS' },
  { city: 'Novo Hamburgo', uf: 'RS', label: 'Novo Hamburgo, RS' },

  // BA
  { city: 'Salvador', uf: 'BA', label: 'Salvador, BA' },
  { city: 'Feira de Santana', uf: 'BA', label: 'Feira de Santana, BA' },
  { city: 'Vitória da Conquista', uf: 'BA', label: 'Vitória da Conquista, BA' },
  { city: 'Camaçari', uf: 'BA', label: 'Camaçari, BA' },
  { city: 'Lauro de Freitas', uf: 'BA', label: 'Lauro de Freitas, BA' },
  { city: 'Itabuna', uf: 'BA', label: 'Itabuna, BA' },
  { city: 'Ilhéus', uf: 'BA', label: 'Ilhéus, BA' },

  // PE
  { city: 'Recife', uf: 'PE', label: 'Recife, PE' },
  { city: 'Jaboatão dos Guararapes', uf: 'PE', label: 'Jaboatão dos Guararapes, PE' },
  { city: 'Olinda', uf: 'PE', label: 'Olinda, PE' },
  { city: 'Caruaru', uf: 'PE', label: 'Caruaru, PE' },
  { city: 'Petrolina', uf: 'PE', label: 'Petrolina, PE' },

  // CE
  { city: 'Fortaleza', uf: 'CE', label: 'Fortaleza, CE' },
  { city: 'Caucaia', uf: 'CE', label: 'Caucaia, CE' },
  { city: 'Juazeiro do Norte', uf: 'CE', label: 'Juazeiro do Norte, CE' },
  { city: 'Maracanaú', uf: 'CE', label: 'Maracanaú, CE' },
  { city: 'Sobral', uf: 'CE', label: 'Sobral, CE' },

  // GO & DF
  { city: 'Goiânia', uf: 'GO', label: 'Goiânia, GO' },
  { city: 'Aparecida de Goiânia', uf: 'GO', label: 'Aparecida de Goiânia, GO' },
  { city: 'Anápolis', uf: 'GO', label: 'Anápolis, GO' },
  { city: 'Rio Verde', uf: 'GO', label: 'Rio Verde, GO' },
  { city: 'Brasília', uf: 'DF', label: 'Brasília, DF' },

  // ES
  { city: 'Vitória', uf: 'ES', label: 'Vitória, ES' },
  { city: 'Vila Velha', uf: 'ES', label: 'Vila Velha, ES' },
  { city: 'Serra', uf: 'ES', label: 'Serra, ES' },
  { city: 'Cariacica', uf: 'ES', label: 'Cariacica, ES' },
  { city: 'Cachoeiro de Itapemirim', uf: 'ES', label: 'Cachoeiro de Itapemirim, ES' },

  // Outros capitais e polos regionais
  { city: 'Manaus', uf: 'AM', label: 'Manaus, AM' },
  { city: 'Belém', uf: 'PA', label: 'Belém, PA' },
  { city: 'Ananindeua', uf: 'PA', label: 'Ananindeua, PA' },
  { city: 'Santarém', uf: 'PA', label: 'Santarém, PA' },
  { city: 'Cuiabá', uf: 'MT', label: 'Cuiabá, MT' },
  { city: 'Várzea Grande', uf: 'MT', label: 'Várzea Grande, MT' },
  { city: 'Rondonópolis', uf: 'MT', label: 'Rondonópolis, MT' },
  { city: 'Campo Grande', uf: 'MS', label: 'Campo Grande, MS' },
  { city: 'Dourados', uf: 'MS', label: 'Dourados, MS' },
  { city: 'São Luís', uf: 'MA', label: 'São Luís, MA' },
  { city: 'Imperatriz', uf: 'MA', label: 'Imperatriz, MA' },
  { city: 'João Pessoa', uf: 'PB', label: 'João Pessoa, PB' },
  { city: 'Campina Grande', uf: 'PB', label: 'Campina Grande, PB' },
  { city: 'Natal', uf: 'RN', label: 'Natal, RN' },
  { city: 'Mossoró', uf: 'RN', label: 'Mossoró, RN' },
  { city: 'Maceió', uf: 'AL', label: 'Maceió, AL' },
  { city: 'Aracaju', uf: 'SE', label: 'Aracaju, SE' },
  { city: 'Teresina', uf: 'PI', label: 'Teresina, PI' },
  { city: 'Palmas', uf: 'TO', label: 'Palmas, TO' },
  { city: 'Porto Velho', uf: 'RO', label: 'Porto Velho, RO' },
  { city: 'Rio Branco', uf: 'AC', label: 'Rio Branco, AC' },
  { city: 'Macapá', uf: 'AP', label: 'Macapá, AP' },
  { city: 'Boa Vista', uf: 'RR', label: 'Boa Vista, RR' },
];

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

  const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const filteredOptions = POPULAR_CITIES.filter((item) => {
    if (!cleanQuery) return true;
    const cleanLabel = item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanCity = item.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cleanLabel.includes(cleanQuery) || cleanCity.includes(cleanQuery) || item.uf.toLowerCase() === cleanQuery;
  }).slice(0, 12);

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
