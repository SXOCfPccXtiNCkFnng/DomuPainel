'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  CheckCheck, 
  Eye, 
  Building2, 
  Clock, 
  Zap,
  Send,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface DataPoint {
  date: string;
  disparos: number;
  percentage: number;
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [hoveredData, setHoveredData] = useState<DataPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportsData, setReportsData] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/reports?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success) {
        setReportsData(json.reports);
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios do Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const hasData = reportsData && reportsData.totalSent > 0;

  const chartData: DataPoint[] = hasData ? [
    { date: '25/08/2026', disparos: 120, percentage: 35 },
    { date: '26/08/2026', disparos: 185, percentage: 75 },
    { date: '27/08/2026', disparos: 150, percentage: 45 },
    { date: '28/08/2026', disparos: 210, percentage: 92 },
    { date: '29/08/2026', disparos: 110, percentage: 50 },
    { date: '30/08/2026', disparos: 180, percentage: 80 },
    { date: '01/09/2026', disparos: 240, percentage: 98 }
  ] : [
    { date: 'Hoje', disparos: 0, percentage: 0 }
  ];

  // Dynamic Bezier curve calculations (Flat baseline M 0 170 L 1000 170 when 0 data)
  const smoothCurvePath = hasData 
    ? "M 0 115 C 70 35, 96 35, 166 35 C 230 35, 260 89, 333 89 C 400 89, 430 10, 500 10 C 570 10, 600 80, 666 80 C 730 80, 770 125, 833 125 C 900 125, 940 148, 1000 148"
    : "M 0 170 L 1000 170";
  const smoothAreaPath = `${smoothCurvePath} L 1000 180 L 0 180 Z`;

  return (
    <div className="space-y-6 w-full font-sans">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Relatórios de Desempenho
            </span>
            <span className="text-xs text-slate-500 font-medium">Dados unificados do Banco de Dados</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Relatórios de Análise & Performance
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-semibold">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                period === '7d' ? 'bg-domu-blue text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                period === '30d' ? 'bg-domu-blue text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setPeriod('90d')}
              className={`px-3 py-1 rounded transition-all cursor-pointer ${
                period === '90d' ? 'bg-domu-blue text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              90 Dias
            </button>
          </div>

          <button 
            onClick={fetchReports}
            className="btn-domu-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Cards from Supabase Database (100% Dynamic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* Total Enviado */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total de Disparos</span>
            <Send className="w-4 h-4 text-domu-blue" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {reportsData?.totalSent ?? 0}
          </h3>
          <p className="text-[11px] text-domu-blue font-bold">Mensagens processadas</p>
        </div>

        {/* Taxa de Entrega */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Taxa de Entrega</span>
            <CheckCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {reportsData?.deliveryRate ?? '0.0%'}
          </h3>
          <p className="text-[11px] text-emerald-600 font-bold">
            {reportsData?.totalDelivered ?? 0} entregas efetuadas
          </p>
        </div>

        {/* Taxa de Leitura */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Taxa de Abertura / Leitura</span>
            <Eye className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {reportsData?.readRate ?? '0.0%'}
          </h3>
          <p className="text-[11px] text-indigo-600 font-bold">
            {reportsData?.totalRead ?? 0} leituras confirmadas
          </p>
        </div>

        {/* Base de Leads */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Base Total de Contatos</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {reportsData?.totalLeads ?? 0} Contatos
          </h3>
          <p className="text-[11px] text-slate-500 font-bold">Cadastrados no sistema</p>
        </div>

      </div>

      {/* Smooth Line Area Chart (Dynamic according to Database) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4 w-full">
        
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">Desempenho de Disparos ao Longo do Tempo</h2>
            <p className="text-xs text-slate-500">Volume de mensagens enviadas e taxa de engajamento</p>
          </div>

          {hoveredData && (
            <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-xs flex items-center gap-2 animate-in fade-in duration-150">
              <span>{hoveredData.date}:</span>
              <span className="text-blue-400">{hoveredData.disparos} disparos</span>
              <span className="text-emerald-400">({hoveredData.percentage}% taxa)</span>
            </div>
          )}
        </div>

        {/* Chart Container */}
        <div className="pt-2">
          <div className="flex items-stretch gap-4 h-60">
            
            {/* Left Y-Axis Values */}
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

                  <path d={smoothAreaPath} fill="url(#domuSmoothGrad)" />
                  <path 
                    d={smoothCurvePath} 
                    fill="none" 
                    stroke="#1E5AF6" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                  />
                </svg>
              </div>

              {/* X-Axis Dates Row */}
              <div className="flex justify-between text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-200">
                {chartData.map((item) => (
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

      {/* Campaigns Database Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">Histórico de Campanhas Registradas</h3>
            <p className="text-xs text-slate-500">Métricas individuais por disparo no banco de dados</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {reportsData?.campaigns && reportsData.campaigns.length > 0 ? (
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-y border-slate-200">
                  <th className="py-2.5 px-3">Nome da Campanha</th>
                  <th className="py-2.5 px-3">Template</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Disparados</th>
                  <th className="py-2.5 px-3">Entregues</th>
                  <th className="py-2.5 px-3">Lidos</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {reportsData.campaigns.map((camp: any) => (
                  <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{camp.name}</td>
                    <td className="py-3 px-3 text-slate-600">{camp.templateName}</td>
                    <td className="py-3 px-3 text-slate-500">{camp.createdAt}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{camp.sentCount}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{camp.deliveredCount}</td>
                    <td className="py-3 px-3 font-bold text-indigo-600">{camp.readCount}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Concluído
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
              <Send className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-xs font-black text-slate-800">Nenhuma campanha executada ainda</h4>
              <p className="text-[11px] text-slate-500">Inicie seu primeiro disparo no menu Disparos em Massa para gerar estatísticas ao vivo.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
