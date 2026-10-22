/** Formatação de contato usada nas listas do /interno. */
import type { PaymentState } from '@/lib/platformUsers';

export const PAYMENT_BADGE: Record<PaymentState, { text: string; className: string }> = {
  PAYING: { text: 'Pagando', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  COURTESY: { text: 'Cortesia', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  TRIAL: { text: 'Trial', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  PENDING: { text: 'Não pagou', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PAST_DUE: { text: 'Em atraso', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELED: { text: 'Cancelou', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  NONE: { text: 'Sem assinatura', className: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw || '—';
}

export function whatsappLink(raw: string, text?: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length < 10) return null;
  const number = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function relativeTime(iso: string | null, never = 'Nunca'): string {
  if (!iso) return never;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m > 1 ? 'meses' : 'mês'}`;
}

export function fullDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
