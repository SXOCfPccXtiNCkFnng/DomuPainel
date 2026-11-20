'use client';

import React, { useState } from 'react';
import { AlertTriangle, FileUp, Loader2, Trash2, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import { MENU_CATEGORIES, normalizeName, validateMenuItemInput, type MenuItem } from '@/lib/pizzeria';
import type { ImportedItem } from '@/lib/menuImport';

type Row = ImportedItem & { key: number; include: boolean; duplicate: boolean };

const MAX_PDF_BYTES = 3 * 1024 * 1024;

/** Foto → JPEG de até 2000px (fica leve e a IA lê bem). */
async function imageToBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Importar cardápio: foto(s), PDF, planilha CSV ou texto colado. A IA lê, o
 * dono revisa e só então os itens são salvos.
 */
export default function MenuImportModal({
  isOpen,
  existing,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  existing: MenuItem[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const existingKeys = new Set(existing.map((m) => `${normalizeName(m.category)}|${normalizeName(m.name)}`));
  const addRows = (items: ImportedItem[]) =>
    setRows((current) => {
      const keys = new Set(current.map((r) => `${normalizeName(r.category)}|${normalizeName(r.name)}`));
      const fresh = items
        .filter((i) => !keys.has(`${normalizeName(i.category)}|${normalizeName(i.name)}`))
        .map((i, n) => {
          const duplicate = existingKeys.has(`${normalizeName(i.category)}|${normalizeName(i.name)}`);
          return { ...i, key: Date.now() + n + Math.random(), include: !duplicate, duplicate };
        });
      return [...current, ...fresh];
    });

  const read = async (body: Record<string, unknown>, label: string) => {
    setBusy(`Lendo ${label}...`);
    setError(null);
    try {
      const res = await fetch('/api/pizzeria/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(`${label}: ${json.error || 'não foi possível ler.'}`);
        return;
      }
      addRows(json.items || []);
    } catch {
      setError(`${label}: não foi possível ler.`);
    } finally {
      setBusy(null);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8)) {
      const name = file.name.toLowerCase();
      if (file.type.startsWith('image/')) {
        await read({ file: { mimeType: 'image/jpeg', data: await imageToBase64(file) } }, file.name);
      } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        if (file.size > MAX_PDF_BYTES) {
          setError(`${file.name}: PDF acima de 3 MB. Divida o arquivo ou envie fotos das páginas.`);
          continue;
        }
        await read({ file: { mimeType: 'application/pdf', data: await fileToBase64(file) } }, file.name);
      } else if (name.endsWith('.csv') || name.endsWith('.txt') || file.type.startsWith('text/')) {
        await read({ text: await file.text() }, file.name);
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        setError(`${file.name}: no Excel, use "Salvar como → CSV" e envie o CSV, ou copie as células e cole no campo de texto.`);
      } else {
        setError(`${file.name}: formato não suportado. Use foto, PDF, CSV ou cole o texto.`);
      }
    }
  };

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setPrice = (row: Row, i: number, patch: Partial<{ size: string; price: string }>) =>
    update(row.key, { prices: row.prices.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const checks = rows.map((r) => ({ row: r, result: validateMenuItemInput({ ...r, active: true }) }));
  const selected = checks.filter((c) => c.row.include);
  const invalid = selected.filter((c) => !c.result.ok);

  const save = async () => {
    if (invalid.length) {
      setError(`Corrija ou desmarque ${invalid.length} item(ns) com problema antes de salvar.`);
      return;
    }
    setBusy('Salvando...');
    setError(null);
    const items = selected.map((c) => ({ ...c.row, active: true }));
    let saved = 0;
    try {
      for (let i = 0; i < items.length; i += 60) {
        const res = await fetch('/api/pizzeria/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: items.slice(i, i + 60) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!json.success) {
          setError(`${saved ? `${saved} itens salvos. ` : ''}${json.error || 'Não foi possível salvar.'}`);
          if (saved) onSaved(saved);
          return;
        }
        saved += (json.items || []).length;
      }
      setRows([]);
      setText('');
      onSaved(saved);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Importar cardápio"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-4xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Importar cardápio</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center cursor-pointer hover:border-domu-blue space-y-1.5 block">
            <FileUp className="w-6 h-6 text-domu-blue mx-auto" />
            <span className="block text-xs font-bold text-slate-800">Enviar foto, PDF ou planilha</span>
            <span className="block text-[10.5px] text-slate-500">
              Foto do cardápio impresso, print do iFood ou do Instagram, PDF ou planilha CSV. Pode mandar várias fotos de uma vez.
            </span>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.csv,.txt,.xlsx,.xls"
              className="sr-only"
              disabled={Boolean(busy)}
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={'Ou cole aqui o cardápio (do WhatsApp, site ou planilha):\nX-Burger ........ 25,00\nX-Bacon ......... 29,90\nCoca lata ....... 6,00'}
              className={`${agendaInputClass} resize-y`}
            />
            <button
              type="button"
              disabled={Boolean(busy) || text.trim().length < 5}
              onClick={() => read({ text }, 'Texto colado')}
              className="btn-domu-primary text-xs py-2 px-4 disabled:opacity-50"
            >
              Ler texto
            </button>
          </div>
        </div>

        {busy && (
          <p className="text-xs text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {busy} (pode levar até 30 segundos)
          </p>
        )}
        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        {rows.length > 0 && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-700">
                <b>{rows.length}</b> itens lidos · <b>{selected.length}</b> marcados
                {invalid.length > 0 && <span className="text-amber-700"> · {invalid.length} precisam de ajuste</span>}
              </p>
              <p className="text-[10.5px] text-slate-500">Confira os preços: a atendente vai cobrar exatamente o que estiver aqui.</p>
            </div>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              {checks.map(({ row, result }) => (
                <div key={row.key} className={`p-3 space-y-2 ${row.include ? '' : 'opacity-50'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => update(row.key, { include: e.target.checked })}
                      aria-label={`Importar ${row.name}`}
                      className="rounded border-slate-300 text-domu-blue"
                    />
                    <select value={row.category} onChange={(e) => update(row.key, { category: e.target.value })} className={`${agendaInputClass} w-40`} aria-label="Categoria">
                      {MENU_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <input value={row.name} onChange={(e) => update(row.key, { name: e.target.value })} className={`${agendaInputClass} flex-1 min-w-[140px]`} aria-label="Nome" />
                    {row.duplicate && <span className="text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1.5">já está no cardápio</span>}
                    {row.include && !result.ok && (
                      <span className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {result.error}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    {row.prices.map((p, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input value={p.size} onChange={(e) => setPrice(row, i, { size: e.target.value })} placeholder="Tamanho" className={`${agendaInputClass} w-24`} aria-label="Tamanho" />
                        <input
                          value={p.price}
                          onChange={(e) => setPrice(row, i, { price: e.target.value })}
                          placeholder="R$"
                          inputMode="decimal"
                          className={`${agendaInputClass} w-20 ${!p.price ? 'border-amber-400' : ''}`}
                          aria-label="Preço"
                        />
                        {row.prices.length > 1 && (
                          <button type="button" onClick={() => update(row.key, { prices: row.prices.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-500" aria-label="Remover tamanho">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {row.description && <span className="text-[10.5px] text-slate-500 truncate max-w-xs">{row.description}</span>}
                    {row.category.startsWith('Pizza') && row.prices.some((p) => p.size) && (
                      <label className="text-[11px] text-slate-600 flex items-center gap-1">
                        <input type="checkbox" checked={row.allows_half} onChange={(e) => update(row.key, { allows_half: e.target.checked })} className="rounded border-slate-300" />
                        meio a meio
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRows([])} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                Limpar
              </button>
              <button type="button" onClick={save} disabled={Boolean(busy) || !selected.length} className="btn-domu-primary text-xs py-2 px-4 disabled:opacity-50">
                Salvar {selected.length} itens no cardápio
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
