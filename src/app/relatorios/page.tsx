'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  CheckCheck, 
  Eye, 
  Building2, 
  Clock, 
  Zap
} from 'lucide-react';

interface DataPoint {
  date: string;
  disparos: number;
  percentage: number;
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'year'>('30d');
  const [hoveredData, setHoveredData] = useState<DataPoint | null>(null);

  const data: DataPoint[] = [
    { date: '22/08/2026', disparos: 120, percentage: 35 },
    { date: '23/08/2026', disparos: 185, percentage: 75 },
    { date: '24/08/2026', disparos: 150, percentage: 45 },
    { date: '25/08/2026', disparos: 210, percentage: 92 },
    { date: '26/08/2026', disparos: 110, percentage: 50 },
    { date: '27/08/2026', disparos: 55, percentage: 25 },
    { date: '28/08/2026', disparos: 24, percentage: 12 }
  ];

  // Dynamic Smooth Bezier Path calculation (0 to 1000 width, 0 to 180 height)
  // 100% = y: 10, 0% = y: 170
  const smoothCurvePath = "M 0 115 C 70 35, 96 35, 166 35 C 230 35, 260 89, 333 89 C 400 89, 430 10, 500 10 C 570 10, 600 80, 666 80 C 730 80, 770 125, 833 125 C 900 125, 940 148, 1000 148";
  const smoothAreaPath = `${smoothCurvePath} L 1000 180 L 0 180 Z`;

  return (
    <div className="space-y-6 w-full">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200">
              Módulo de Analytics & Business Intelligence
            </span>
            <span className="text-xs text-slate-500 font-medium">Relatórios Gerenciais Imobiliários</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Relatórios de Análise & Performance
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-semibold">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1 rounded transition-all ${
                period === '7d' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1 rounded transition-all ${
                period === '30d' ? 'bg-domu-blue text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setPeriod('90d')}
              className={`px-3 py-1 rounded transition-all ${
                period === '90d' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              90 Dias
            </button>
          </div>

          <button className="btn-domu-primary text-xs py-1.5 px-3">
            <Download className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Taxa de Entrega Meta API</span>
            <CheckCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">98.4%</h3>
          <p className="text-[11px] text-emerald-600 font-bold">+1.2% vs mês anterior (840 entregues)</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Taxa de Abertura / Leitura</span>
            <Eye className="w-4 h-4 text-domu-blue" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">68.8%</h3>
          <p className="text-[11px] text-domu-blue font-bold">578 leituras confirmadas</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Visitas Agendadas</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">42 Visitas</h3>
          <p className="text-[11px] text-slate-500 font-bold">7.2% conversão de leads qualificados</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Custo por Lead Qualificado</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">R$ 3,40</h3>
          <p className="text-[11px] text-emerald-600 font-bold">-14% em relação à mídia paga tradicional</p>
        </div>
      </div>

      {/* Clean Smooth Line Area Chart (Matching Reference Image Exactly) */}
      <div className="bg-white rounded-md border border-slate-200/80 p-6 shadow-sm space-y-4 w-full">
        
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Taxa de Disparos</h2>
            <p className="text-xs text-slate-500">Volume e taxa de conversão (%) ao longo do tempo</p>
          </div>

          {hoveredData && (
            <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded shadow-sm flex items-center gap-2 animate-in fade-in duration-150">
              <span>{hoveredData.date}:</span>
              <span className="text-domu-blue">{hoveredData.disparos} disparos</span>
              <span className="text-emerald-400">({hoveredData.percentage}% taxa)</span>
            </div>
          )}
        </div>

        {/* Chart Main Box with Left Y-Axis & Dates X-Axis */}
        <div className="pt-2">
          <div className="flex items-stretch gap-4 h-60">
            
            {/* Left Y-Axis Values (100%, 75%, 50%, 25%, 0%) */}
            <div className="flex flex-col justify-between text-[11px] font-medium text-slate-400 select-none pb-7 shrink-0 text-right w-10">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
              
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
                <div className="border-b border-dotted border-slate-200 w-full"></div>
                <div className="border-b border-dotted border-slate-200 w-full"></div>
                <div className="border-b border-dotted border-slate-200 w-full"></div>
                <div className="border-b border-dotted border-slate-200 w-full"></div>
                <div className="border-b border-slate-200 w-full"></div>
              </div>

              {/* Smooth Area SVG */}
              <div className="relative flex-1 w-full pb-7">
                <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="domuSmoothGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E5AF6" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#1E5AF6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Fill */}
                  <path d={smoothAreaPath} fill="url(#domuSmoothGrad)" />

                  {/* Smooth Blue Stroke Line */}
                  <path 
                    d={smoothCurvePath} 
                    fill="none" 
                    stroke="#1E5AF6" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                </svg>
              </div>

              {/* X-Axis Dates Row (Matching Reference Image) */}
              <div className="flex justify-between text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-200">
                {data.map((item, idx) => (
                  <div 
                    key={item.date} 
                    onMouseEnter={() => setHoveredData(item)}
                    onMouseLeave={() => setHoveredData(null)}
                    className="cursor-pointer hover:text-domu-blue transition-colors px-1 py-0.5"
                  >
                    {item.date}
                  </div>
                ))}
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* 2 Column Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        
        {/* Left: Demanda por Bairro / Região (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-domu-blue" />
              Bairros com Maior Demanda de Leads
            </h3>
            <p className="text-[11px] text-slate-500">Distribuição dos interesses capturados no WhatsApp</p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-800">Alto da Boa Vista</span>
                <span className="text-domu-blue">142 leads (38%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-domu-blue h-full w-[38%] rounded-full"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-800">Bonfim Paulista</span>
                <span className="text-domu-blue">89 leads (28%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-domu-blue h-full w-[28%] rounded-full"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-800">Jardim Botânico</span>
                <span className="text-domu-blue">75 leads (22%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-domu-blue h-full w-[22%] rounded-full"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-800">Zona Sul / Vila Ana Maria</span>
                <span className="text-domu-blue">42 leads (12%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-domu-blue h-full w-[12%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Horários de Maior Conversão no WhatsApp (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Horários com Maior Taxa de Resposta
            </h3>
            <p className="text-[11px] text-slate-500">Janela ideal recomendada para agendar disparos</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 bg-emerald-50 rounded border border-emerald-200 space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Melhor Horário 1</span>
              <h4 className="text-lg font-black text-emerald-900">10h às 11h30</h4>
              <p className="text-[11px] text-emerald-700 font-bold">34% das respostas imediatas</p>
            </div>

            <div className="p-3.5 bg-blue-50 rounded border border-blue-200 space-y-1">
              <span className="text-[10px] font-extrabold text-domu-blue uppercase block">Melhor Horário 2</span>
              <h4 className="text-lg font-black text-slate-900">17h às 19h</h4>
              <p className="text-[11px] text-domu-blue font-bold">48% das conversões de visita</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 font-medium">
            💡 <strong>Dica DOMU IA:</strong> Disparar alertas de imóveis às terças e quintas entre 17h e 18h30 gera <strong>2.4x mais agendamentos de visita</strong>.
          </div>
        </div>

      </div>

    </div>
  );
}
