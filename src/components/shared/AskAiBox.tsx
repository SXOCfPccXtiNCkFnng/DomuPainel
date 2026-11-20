'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircleQuestion, Send } from 'lucide-react';

type QA = { id: string; question: string; answer: string | null; created_at: string };

/** "Pergunte para a IA" sobre os números da conta (Pro e Enterprise). Some no Starter. */
export default function AskAiBox() {
  const [state, setState] = useState<{ used: number; limit: number; suggestions: string[] } | null>(null);
  const [history, setHistory] = useState<QA[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/insights/ask')
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || json.locked || json.aiAvailable === false) return;
        setState({ used: json.used, limit: json.limit, suggestions: json.suggestions || [] });
        setHistory(json.history || []);
      })
      .catch(() => undefined);
  }, []);

  if (!state) return null;
  const left = Math.max(0, state.limit - state.used);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/insights/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || 'Não foi possível responder.');
        return;
      }
      setHistory((h) => [json.item, ...h].slice(0, 10));
      setState((s) => (s ? { ...s, used: json.used ?? s.used + 1 } : s));
      setQuestion('');
    } catch {
      setError('Não foi possível responder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <MessageCircleQuestion className="w-4 h-4 text-domu-blue" /> Pergunte para a IA
        </h2>
        <span className="text-[10.5px] text-slate-500">
          {left} de {state.limit} perguntas restantes no mês
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          disabled={busy || left === 0}
          placeholder="Ex.: o que mais vendeu no sábado? que combo eu devia criar?"
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-domu-blue disabled:bg-slate-50"
          aria-label="Sua pergunta"
        />
        <button type="submit" disabled={busy || left === 0 || question.trim().length < 4} className="btn-domu-primary text-xs py-2 px-3 flex items-center gap-1.5 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Perguntar
        </button>
      </form>
      {history.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.suggestions.map((s) => (
            <button key={s} type="button" disabled={busy || left === 0} onClick={() => ask(s)} className="px-2.5 py-1 rounded-full border border-slate-200 text-[11px] text-slate-600 hover:border-domu-blue hover:text-domu-blue">
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {busy && <p className="text-[11px] text-slate-500">Analisando seus números...</p>}
      {history.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {history.map((h) => (
            <div key={h.id} className="space-y-1">
              <p className="text-xs font-bold text-slate-900">{h.question}</p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl px-3 py-2">{h.answer}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10.5px] text-slate-400">A IA responde só com os números da sua conta. Confira antes de decisões grandes.</p>
    </section>
  );
}
