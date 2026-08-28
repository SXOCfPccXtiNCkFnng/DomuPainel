'use client';

import React, { useState, useEffect } from 'react';
import { Pause, Play, Send, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { QueueLog } from '@/types';
import { mockQueueLogs } from '@/lib/mockData';

interface QueueSimulatorProps {
  campaignTitle: string;
  totalRecipients: number;
}

export default function QueueSimulator({ campaignTitle, totalRecipients }: QueueSimulatorProps) {
  const [isSending, setIsSending] = useState(true);
  const [sentCount, setSentCount] = useState(48);
  const [deliveredCount, setDeliveredCount] = useState(45);
  const [readCount, setReadCount] = useState(38);
  const [logs, setLogs] = useState<QueueLog[]>(mockQueueLogs);
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);

  useEffect(() => {
    if (!isSending) return;

    const interval = setInterval(() => {
      setSentCount((prev) => {
        if (prev >= totalRecipients) {
          setIsSending(false);
          return totalRecipients;
        }
        return prev + 1;
      });

      setDeliveredCount((prev) => Math.min(prev + 1, sentCount));
      setReadCount((prev) => Math.min(prev + (Math.random() > 0.4 ? 1 : 0), deliveredCount));

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const names = ['Gabriel Santos', 'Juliana Lima', 'Fernando Ribeiro', 'Camila Costa', 'Thiago Martins'];
      const randomName = names[Math.floor(Math.random() * names.length)];

      const newLog: QueueLog = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        recipientPhone: `+55 16 99${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        recipientName: randomName,
        status: 'READ',
        details: 'Enviado via Cloud API da Meta • Entregue & Lido'
      };

      setLogs((prevLogs) => [newLog, ...prevLogs.slice(0, 7)]);
    }, 1800);

    return () => clearInterval(interval);
  }, [isSending, totalRecipients, sentCount, deliveredCount]);

  const progressPercentage = Math.round((sentCount / totalRecipients) * 100);

  return (
    <div className="bg-white rounded-md border border-slate-200/80 p-5 shadow-sm space-y-4">
      
      {/* Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blue-50 text-domu-blue flex items-center justify-center border border-blue-100 shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider ${
                isSending 
                  ? 'text-domu-blue' 
                  : 'text-emerald-600'
              }`}>
                {isSending ? 'Em Processamento' : 'Disparo Concluído'}
              </span>
              <span className="text-xs text-slate-500 font-medium">Meta Cloud API (5 msgs/seg)</span>
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">{campaignTitle}</h3>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSending(!isSending)}
            className="px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {isSending ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-500" />
                <span>Pausar Fila</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                <span>Retomar Fila</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar & Visual Counter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-600">Progresso do Envio</span>
          <span className="text-domu-blue font-black">{sentCount} de {totalRecipients} ({progressPercentage}%)</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
          <div 
            className="bg-domu-blue h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Clean Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Enviados</span>
          <span className="text-lg font-black text-slate-900">{sentCount}</span>
        </div>

        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Entregues</span>
          <span className="text-lg font-black text-emerald-600">{deliveredCount}</span>
        </div>

        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Lidos</span>
          <span className="text-lg font-black text-domu-blue">{readCount}</span>
        </div>

        <div className="p-3 rounded bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Bloqueios / Bans</span>
          <span className="text-lg font-black text-emerald-600 flex items-center gap-1">
            0 <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </span>
        </div>
      </div>

      {/* Visual Clean Contacts Live Stream */}
      <div className="pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span className="flex items-center gap-1.5 text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Envios em Tempo Real
          </span>

          <button
            onClick={() => setShowTechnicalLog(!showTechnicalLog)}
            className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
          >
            <Terminal className="w-3 h-3" />
            <span>{showTechnicalLog ? 'Ocultar Log Técnico' : 'Exibir Log Técnico (Webhooks)'}</span>
            {showTechnicalLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Clean Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {logs.slice(0, 3).map((log) => (
            <div key={log.id} className="p-2.5 rounded bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div className="truncate">
                <p className="font-bold text-slate-900 truncate">{log.recipientName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{log.recipientPhone}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                ✓ Entregue
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Technical Webhook Log */}
      {showTechnicalLog && (
        <div className="bg-slate-900 rounded p-3 border border-slate-800 text-slate-200 font-mono text-[11px] space-y-1 mt-3">
          <p className="text-[10px] text-emerald-400 font-bold uppercase pb-1 border-b border-slate-800">
            Console de Webhooks da Meta Cloud API
          </p>
          <div className="space-y-1 pt-1 max-h-28 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex justify-between text-[10px] text-slate-300">
                <span>[{log.timestamp}] {log.recipientName} ({log.recipientPhone})</span>
                <span className="text-emerald-400">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
