'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import {
  formatBRL,
  PAYMENT_METHODS,
  priceOrder,
  type MenuItem,
  type OrderItemInput,
  type PizzeriaSettings,
} from '@/lib/pizzeria';

type Line = { key: number; itemId: string; secondId: string; size: string; quantity: number; notes: string };

/** Pedido lançado pela equipe (telefone, balcão). O valor sai do cardápio, igual ao da atendente. */
export default function NewOrderModal({
  isOpen,
  menu,
  settings,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  menu: MenuItem[];
  settings: PizzeriaSettings | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const active = useMemo(() => menu.filter((m) => m.active), [menu]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'ENTREGA' | 'RETIRADA'>('ENTREGA');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [payment, setPayment] = useState('');
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = (id: string) => active.find((m) => m.id === id);
  const items: OrderItemInput[] = lines
    .filter((l) => byId(l.itemId))
    .map((l) => {
      const first = byId(l.itemId)!;
      const second = l.secondId ? byId(l.secondId) : null;
      return {
        ...(second ? { sabores: [first.name, second.name] } : { item: first.name }),
        tamanho: l.size,
        quantidade: l.quantity,
        observacao: l.notes,
      };
    });
  const preview =
    settings && items.length
      ? priceOrder({ menu: active, settings: { ...settings, min_order: 0 }, items, fulfillment, area })
      : null;

  if (!isOpen) return null;

  const addLine = (itemId: string) => {
    const item = byId(itemId);
    if (!item) return;
    const sizes = item.prices.map((p) => p.size).filter(Boolean);
    setLines((ls) => [
      ...ls,
      { key: Date.now() + Math.random(), itemId, secondId: '', size: sizes.includes('Grande') ? 'Grande' : sizes[0] || '', quantity: 1, notes: '' },
    ]);
  };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/pizzeria/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          fulfillment,
          address,
          area,
          paymentMethod: payment,
          changeFor,
          notes,
          items,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || 'Não foi possível lançar o pedido.');
        return;
      }
      setLines([]);
      setName('');
      setPhone('');
      setAddress('');
      setArea('');
      setNotes('');
      setChangeFor('');
      onCreated();
      onClose();
    } catch {
      setError('Não foi possível lançar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Novo pedido"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Novo pedido (telefone ou balcão)</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Nome do cliente</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={agendaInputClass} />
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">WhatsApp (com DDD)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(11) 99999-9999" className={agendaInputClass} />
          </label>
        </div>

        <div className="flex gap-2">
          {(['ENTREGA', 'RETIRADA'] as const)
            .filter((f) => (f === 'ENTREGA' ? settings?.delivery_enabled !== false : settings?.pickup_enabled !== false))
            .map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFulfillment(f)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                  fulfillment === f ? 'bg-domu-blue text-white border-domu-blue' : 'border-slate-200 text-slate-600'
                }`}
              >
                {f === 'ENTREGA' ? 'Entrega' : 'Retirada'}
              </button>
            ))}
        </div>
        {fulfillment === 'ENTREGA' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-bold text-slate-600">Endereço com número</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={agendaInputClass} />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Bairro</span>
              {settings?.delivery_areas.length ? (
                <select value={area} onChange={(e) => setArea(e.target.value)} className={agendaInputClass}>
                  <option value="">Escolha</option>
                  {settings.delivery_areas.map((a) => (
                    <option key={a.area} value={a.area}>
                      {a.area} ({a.fee ? formatBRL(a.fee) : 'grátis'})
                    </option>
                  ))}
                </select>
              ) : (
                <input value={area} onChange={(e) => setArea(e.target.value)} className={agendaInputClass} />
              )}
            </label>
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600">Itens</span>
            <select value="" onChange={(e) => addLine(e.target.value)} className={`${agendaInputClass} w-auto max-w-[60%]`} aria-label="Adicionar item">
              <option value="">+ Adicionar item</option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.category} · {m.name}
                </option>
              ))}
            </select>
          </div>
          {lines.length === 0 && <p className="text-[11px] text-slate-400">Nenhum item ainda.</p>}
          {lines.map((l) => {
            const item = byId(l.itemId);
            if (!item) return null;
            const sizes = item.prices.map((p) => p.size).filter(Boolean);
            const halves = item.allows_half && (settings?.max_flavors ?? 2) > 1 ? active.filter((m) => m.allows_half && m.id !== item.id) : [];
            return (
              <div key={l.key} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-900 flex-1 truncate">{item.name}</p>
                  <button type="button" onClick={() => update(l.key, { quantity: Math.max(1, l.quantity - 1) })} className="p-1 rounded border border-slate-200" aria-label="Menos">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold w-5 text-center">{l.quantity}</span>
                  <button type="button" onClick={() => update(l.key, { quantity: Math.min(50, l.quantity + 1) })} className="p-1 rounded border border-slate-200" aria-label="Mais">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="p-1 text-red-500" aria-label="Remover">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {sizes.length > 0 && (
                    <select value={l.size} onChange={(e) => update(l.key, { size: e.target.value })} className={agendaInputClass} aria-label="Tamanho">
                      {sizes.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {halves.length > 0 && (
                    <select value={l.secondId} onChange={(e) => update(l.key, { secondId: e.target.value })} className={agendaInputClass} aria-label="Meio a meio">
                      <option value="">Sabor inteiro</option>
                      {halves.map((m) => (
                        <option key={m.id} value={m.id}>
                          Meio {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input value={l.notes} onChange={(e) => update(l.key, { notes: e.target.value })} placeholder="Obs.: sem cebola" className={agendaInputClass} />
                </div>
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Pagamento</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className={agendaInputClass}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {payment === 'Dinheiro' && (
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Troco para</span>
              <input value={changeFor} onChange={(e) => setChangeFor(e.target.value)} inputMode="decimal" className={agendaInputClass} />
            </label>
          )}
          <label className="space-y-1 sm:col-span-1">
            <span className="block text-[11px] font-bold text-slate-600">Observação</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={agendaInputClass} />
          </label>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-xs">
          {preview?.ok ? (
            <div className="space-y-0.5">
              {preview.order.lines.map((l, i) => (
                <p key={i} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.quantity}x {l.description}
                  </span>
                  <span>{formatBRL(l.total)}</span>
                </p>
              ))}
              {preview.order.delivery_fee > 0 && (
                <p className="flex justify-between text-slate-500">
                  <span>Taxa de entrega</span>
                  <span>{formatBRL(preview.order.delivery_fee)}</span>
                </p>
              )}
              <p className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200 mt-1">
                <span>Total</span>
                <span>{formatBRL(preview.order.total)}</span>
              </p>
            </div>
          ) : (
            <p className="text-slate-500">{preview && !preview.ok ? preview.error : 'Adicione os itens para ver o total.'}</p>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !preview?.ok}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Lançar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
