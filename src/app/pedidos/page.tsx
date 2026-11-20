'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bike,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Printer,
  Store,
  Wallet,
} from 'lucide-react';
import NewOrderModal from '@/components/pizzaria/NewOrderModal';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatPhoneBR } from '@/lib/validators';
import {
  formatBRL,
  NEXT_ACTION_LABELS,
  nextStatus,
  ORDER_STATUS_LABELS,
  type MenuItem,
  type Order,
  type OrderStatus,
  type PizzeriaSettings,
} from '@/lib/pizzeria';

const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

const COLUMNS: { title: string; statuses: OrderStatus[]; tone: string }[] = [
  { title: 'Novos', statuses: ['NOVO'], tone: 'border-amber-300 bg-amber-50/60' },
  { title: 'Em preparo', statuses: ['EM_PREPARO'], tone: 'border-blue-200 bg-blue-50/40' },
  { title: 'Saiu / pronto', statuses: ['SAIU_ENTREGA', 'PRONTO_RETIRADA'], tone: 'border-violet-200 bg-violet-50/40' },
  { title: 'Finalizados hoje', statuses: ['ENTREGUE', 'CANCELADO'], tone: 'border-slate-200 bg-slate-50' },
];

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
}

/** Bipe curto quando chega pedido novo (sem arquivo de áudio). */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
  } catch {
    /* navegador sem áudio: segue sem som */
  }
}

function printTicket(o: Order) {
  const w = window.open('', '_blank', 'width=360,height=600');
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
  const lines = o.items
    .map((l) => `<p><b>${l.quantity}x</b> ${esc(l.description)}${l.notes ? `<br/><i>${esc(l.notes)}</i>` : ''}<span style="float:right">${formatBRL(l.total)}</span></p>`)
    .join('');
  w.document.write(`<html><head><title>Pedido #${o.order_number}</title><style>body{font-family:monospace;font-size:13px;padding:8px}h1{font-size:18px;margin:0}p{margin:4px 0}hr{border:0;border-top:1px dashed #000}</style></head><body>
<h1>Pedido #${o.order_number}</h1><p>${time.format(new Date(o.created_at))} · ${o.fulfillment === 'ENTREGA' ? 'ENTREGA' : 'RETIRADA'}</p><hr/>
<p><b>${esc(o.customer_name)}</b><br/>${esc(formatPhoneBR(o.customer_phone) || o.customer_phone)}</p>
${o.address ? `<p>${esc(o.address)}${o.area ? ` — ${esc(o.area)}` : ''}</p>` : ''}<hr/>${lines}<hr/>
${o.delivery_fee ? `<p>Taxa de entrega<span style="float:right">${formatBRL(o.delivery_fee)}</span></p>` : ''}
<p><b>TOTAL<span style="float:right">${formatBRL(o.total)}</span></b></p>
${o.payment_method ? `<p>Pagamento: ${esc(o.payment_method)}${o.change_for ? ` (troco para ${formatBRL(o.change_for)})` : ''}</p>` : ''}
${o.notes ? `<p>Obs.: ${esc(o.notes)}</p>` : ''}
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<PizzeriaSettings | null>(null);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const knownNew = useRef<Set<string> | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pizzeria/orders');
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível carregar os pedidos.');
        return;
      }
      if (json.available === false) {
        setError(json.error);
        return;
      }
      const list: Order[] = json.orders || [];
      const newIds = list.filter((o) => o.status === 'NOVO').map((o) => o.id);
      if (knownNew.current && newIds.some((id) => !knownNew.current!.has(id))) beep();
      knownNew.current = new Set(newIds);
      setOrders(list);
      setOpenNow(json.openNow ?? null);
      setError(null);
    } catch {
      setError('Não foi possível carregar os pedidos.');
    } finally {
      setIsLoading(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      try {
        const [m, s] = await Promise.all([fetch('/api/pizzeria/menu').then((r) => r.json()), fetch('/api/pizzeria/settings').then((r) => r.json())]);
        if (m.success) setMenu(m.items || []);
        if (s.success) setSettings(s.settings);
      } catch {
        /* o quadro funciona sem isso; só o "novo pedido" precisa */
      }
    })();
  }, [load]);
  // Pedido é tempo real: atualiza a cada 10 s.
  useAutoRefresh(load, { intervalMs: 10_000 });

  const move = async (order: Order, status: OrderStatus) => {
    let cancelReason = '';
    if (status === 'CANCELADO') {
      const ok = await confirm({
        title: `Cancelar o pedido #${order.order_number}?`,
        message: 'O cliente recebe o aviso no WhatsApp (se tiver conversado nas últimas 24h).',
        confirmLabel: 'Cancelar pedido',
        cancelLabel: 'Voltar',
        tone: 'danger',
      });
      if (!ok) return;
      cancelReason = window.prompt('Motivo (opcional, vai para o cliente):', '') || '';
    }
    setBusy(order.id);
    try {
      const res = await fetch('/api/pizzeria/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status, cancelReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || 'Não foi possível atualizar o pedido.');
        await load();
        return;
      }
      setOrders((list) => list.map((o) => (o.id === order.id ? json.order : o)));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando pedidos...
      </div>
    );
  }

  const active = orders.filter((o) => o.status !== 'ENTREGUE' && o.status !== 'CANCELADO');
  const todayDone = orders.filter((o) => o.status === 'ENTREGUE');
  const todayRevenue = orders.filter((o) => o.status !== 'NOVO' && o.status !== 'CANCELADO').reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {openNow !== null && (
            <span className={`px-2.5 py-1 rounded-full font-bold border ${openNow ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {openNow ? 'Aberto agora' : 'Fechado agora'}
            </span>
          )}
          <span className="text-slate-600">
            <b>{active.length}</b> em andamento · <b>{todayDone.length}</b> finalizados hoje · <b>{formatBRL(todayRevenue)}</b> vendidos hoje
          </span>
        </div>
        <button type="button" onClick={() => setNewOpen(true)} className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Novo pedido
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {orders.length === 0 && !error && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-sm font-black text-slate-900">Nenhum pedido hoje ainda</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Os pedidos que a atendente anotar no WhatsApp aparecem aqui na hora, com um bipe. Deixe esta tela aberta no balcão.
            {menu.length === 0 && (
              <>
                {' '}
                Comece{' '}
                <Link href="/cardapio" className="font-bold text-domu-blue underline">
                  cadastrando o cardápio
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => col.statuses.includes(o.status));
            return (
              <section key={col.title} className={`rounded-2xl border p-2.5 space-y-2 ${col.tone}`}>
                <h2 className="text-xs font-black text-slate-900 px-1">
                  {col.title} ({list.length})
                </h2>
                {list.length === 0 && <p className="text-[11px] text-slate-400 px-1 pb-1">Nada aqui.</p>}
                {list.map((o) => {
                  const next = nextStatus(o.status, o.fulfillment);
                  const waiting = minutesSince(o.created_at, now);
                  const late = o.status === 'NOVO' ? waiting > 5 : o.status === 'EM_PREPARO' && waiting > (settings?.delivery_eta_min ?? 50);
                  return (
                    <article key={o.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900">
                            #{o.order_number} · {o.customer_name}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 flex-wrap">
                            <Clock className="w-3 h-3" /> {time.format(new Date(o.created_at))}
                            {o.status !== 'ENTREGUE' && o.status !== 'CANCELADO' && (
                              <span className={late ? 'text-red-600 font-bold' : ''}>· há {waiting} min</span>
                            )}
                            <span>· {o.source === 'WHATSAPP' ? 'Atendente IA' : 'Painel'}</span>
                          </p>
                        </div>
                        <span className="text-sm font-black text-slate-900 shrink-0">{formatBRL(o.total)}</span>
                      </div>
                      <ul className="text-xs text-slate-700 space-y-0.5">
                        {o.items.map((l, i) => (
                          <li key={i}>
                            <b>{l.quantity}x</b> {l.description}
                            {l.notes && <span className="text-amber-700"> · {l.notes}</span>}
                          </li>
                        ))}
                      </ul>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <p className="flex items-start gap-1">
                          {o.fulfillment === 'ENTREGA' ? <Bike className="w-3.5 h-3.5 shrink-0 mt-px" /> : <Store className="w-3.5 h-3.5 shrink-0 mt-px" />}
                          {o.fulfillment === 'ENTREGA' ? (
                            <span>
                              {o.address}
                              {o.area ? ` — ${o.area}` : ''}
                            </span>
                          ) : (
                            'Retirada no local'
                          )}
                        </p>
                        {o.payment_method && (
                          <p className="flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" /> {o.payment_method}
                            {o.change_for ? ` · troco para ${formatBRL(o.change_for)}` : ''}
                          </p>
                        )}
                        {o.notes && <p className="text-amber-700">Obs.: {o.notes}</p>}
                        {o.status === 'CANCELADO' && (
                          <p className="text-red-600 font-bold">Cancelado{o.cancel_reason ? `: ${o.cancel_reason}` : ''}</p>
                        )}
                        {o.status_notice && <p className="text-slate-400">{o.status_notice}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {next && (
                          <button
                            type="button"
                            disabled={busy === o.id}
                            onClick={() => move(o, next)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-domu-blue text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {NEXT_ACTION_LABELS[next]}
                          </button>
                        )}
                        <a
                          href={`https://wa.me/${o.customer_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <button type="button" onClick={() => printTicket(o)} className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 border border-slate-200 flex items-center gap-1">
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>
                        {o.fulfillment === 'ENTREGA' && o.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address} ${o.area || ''}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 border border-slate-200 flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5" /> Mapa
                          </a>
                        )}
                        {o.status !== 'ENTREGUE' && o.status !== 'CANCELADO' && (
                          <button type="button" disabled={busy === o.id} onClick={() => move(o, 'CANCELADO')} className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50">
                            Cancelar
                          </button>
                        )}
                      </div>
                      <p className="sr-only">Status: {ORDER_STATUS_LABELS[o.status]}</p>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[10.5px] text-slate-400">
        Ao avançar um pedido, o cliente recebe o aviso no WhatsApp (confirmado, saiu para entrega, pronto para retirar) quando conversou com vocês nas
        últimas 24 horas — regra da Meta. O aviso pode ser desligado em Cardápio e entrega.
      </p>

      <NewOrderModal isOpen={newOpen} menu={menu} settings={settings} onClose={() => setNewOpen(false)} onCreated={load} />
      {confirmDialog}
    </div>
  );
}
