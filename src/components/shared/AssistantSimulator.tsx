'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, Loader2, RotateCcw, Send } from 'lucide-react';

type Msg = { from: 'cliente' | 'atendente' | 'acao'; text: string };

const EXAMPLES = ['Oi, tem horário amanhã?', 'Quanto custa?', 'Quero fazer um pedido', 'Vocês abrem no domingo?'];

/**
 * Simulador da atendente: o dono conversa como se fosse cliente e vê como ela
 * responde, com as informações cadastradas. Não precisa do WhatsApp conectado
 * e nada é gravado nem enviado.
 */
export default function AssistantSimulator({ examples = EXAMPLES }: { examples?: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const send = async (value: string) => {
    const content = value.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { from: 'cliente', text: content }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter((m) => m.from !== 'acao').map((m) => ({ from: m.from, text: m.text })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || 'Não foi possível responder agora.');
        return;
      }
      setMessages((prev) => [
        ...prev,
        ...((json.actions || []) as string[]).map((a) => ({ from: 'acao' as const, text: a })),
        ...((json.bubbles || []) as string[]).map((b) => ({ from: 'atendente' as const, text: b })),
      ]);
    } catch {
      setError('Não foi possível responder agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-domu-blue" />
          <div>
            <h2 className="text-sm font-black text-slate-900">Teste a sua atendente</h2>
            <p className="text-[11px] text-slate-500">
              Escreva como se fosse um cliente. Ela usa os seus serviços, preços e horários. Nada é gravado nem enviado.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Recomeçar
          </button>
        )}
      </div>

      <div className="bg-[#efeae2] px-3 py-3 h-80 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-slate-600">Comece com uma mensagem de cliente:</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {examples.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => send(e)}
                  className="text-[11px] font-bold bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-700 hover:border-domu-blue"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.from === 'acao' ? (
            <p key={i} className="text-center text-[10.5px] text-slate-600 bg-white/70 border border-slate-200 rounded-lg px-2 py-1 mx-auto max-w-[85%]">
              🧪 {m.text} <span className="text-slate-400">(no teste, nada é gravado)</span>
            </p>
          ) : (
            <div key={i} className={`flex ${m.from === 'cliente' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap shadow-sm ${
                  m.from === 'cliente' ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900'
                }`}
              >
                {m.text}
              </div>
            </div>
          )
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-3 py-2 text-[12px] text-slate-500 flex items-center gap-1.5 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> digitando...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-xs text-red-700 bg-red-50 border-t border-red-200 px-4 py-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 px-3 py-2 border-t border-slate-100"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem do cliente..."
          maxLength={1000}
          className="flex-1 text-sm border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:border-domu-blue"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="w-9 h-9 rounded-full bg-domu-blue text-white flex items-center justify-center disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
}
