'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useModalA11y } from '@/hooks/useModalA11y';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import { WEEKDAY_LABELS, type DayHours } from '@/lib/scheduling';
import {
  DEFAULT_PIZZERIA_SETTINGS,
  formatBRL,
  HALF_HALF_LABELS,
  MENU_CATEGORIES,
  pricesLabel,
  SIZE_SUGGESTIONS,
  type MenuItem,
  type PizzeriaSettings,
} from '@/lib/pizzeria';

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
type PriceRow = { size: string; price: string };
type Draft = {
  id?: string;
  category: string;
  name: string;
  description: string;
  prices: PriceRow[];
  allows_half: boolean;
  featured: boolean;
  active: boolean;
};

const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyDraft = (category = 'Pizzas'): Draft => ({
  category,
  name: '',
  description: '',
  prices: category.startsWith('Pizza') ? SIZE_SUGGESTIONS.slice(0, 3).map((size) => ({ size, price: '' })) : [{ size: '', price: '' }],
  allows_half: category.startsWith('Pizza'),
  featured: false,
  active: true,
});

function ItemModal({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const ref = useModalA11y<HTMLDivElement>(Boolean(draft), onClose);
  const [form, setForm] = useState<Draft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setForm(draft);
    setError(null);
  }, [draft]);
  if (!form) return null;
  const set = (patch: Partial<Draft>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setPrice = (i: number, patch: Partial<PriceRow>) => set({ prices: form.prices.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/pizzeria/menu', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prices: form.prices.filter((p) => p.price.trim() || p.size.trim()) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar.');
        return;
      }
      onSaved();
      onClose();
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
        aria-label="Item do cardápio"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">{form.id ? 'Editar item' : 'Novo item'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Categoria</span>
            <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={agendaInputClass}>
              {MENU_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Nome</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Calabresa" className={agendaInputClass} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="block text-[11px] font-bold text-slate-600">Ingredientes / descrição</span>
          <textarea
            value={form.description}
            rows={2}
            maxLength={300}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Ex.: Molho, mussarela, calabresa fatiada, cebola e orégano"
            className={`${agendaInputClass} resize-y`}
          />
          <span className="block text-[10.5px] text-slate-400">A atendente usa isso para responder &quot;o que vem na pizza?&quot;. Ela não inventa ingrediente.</span>
        </label>
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold text-slate-600">Preços</span>
          {form.prices.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={p.size}
                onChange={(e) => setPrice(i, { size: e.target.value })}
                placeholder={form.prices.length > 1 ? 'Tamanho' : 'Tamanho (opcional)'}
                list="size-suggestions"
                className={`${agendaInputClass} flex-1`}
              />
              <input value={p.price} onChange={(e) => setPrice(i, { price: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className={`${agendaInputClass} w-28`} />
              {form.prices.length > 1 && (
                <button type="button" onClick={() => set({ prices: form.prices.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-500" aria-label="Remover tamanho">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <datalist id="size-suggestions">
            {SIZE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {form.prices.length < 6 && (
            <button type="button" onClick={() => set({ prices: [...form.prices, { size: '', price: '' }] })} className="text-[11px] font-bold text-domu-blue">
              + Adicionar tamanho
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.allows_half} onChange={(e) => set({ allows_half: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
            Pode ser meio a meio
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
            Mais pedida (a atendente sugere)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
            Disponível hoje
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuTab() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pizzeria/menu');
      const json = await res.json();
      if (!json.success || json.available === false) {
        setError(json.error || 'Não foi possível carregar o cardápio.');
        return;
      }
      setItems(json.items || []);
      setCanEdit(Boolean(json.canEdit));
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: MenuItem, patch: { active?: boolean; featured?: boolean }) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const res = await fetch('/api/pizzeria/menu', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, ...patch }) });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || 'Não foi possível atualizar.');
      load();
    }
  };
  const remove = async (item: MenuItem) => {
    if (!(await confirm({ title: `Excluir ${item.name}?`, message: 'Pedidos antigos continuam com o item.', confirmLabel: 'Excluir', tone: 'danger' }))) return;
    await fetch(`/api/pizzeria/menu?id=${item.id}`, { method: 'DELETE' });
    load();
  };
  const edit = (item: MenuItem) =>
    setDraft({
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description || '',
      prices: item.prices.map((p) => ({ size: p.size, price: money(p.price) })),
      allows_half: item.allows_half,
      featured: item.featured,
      active: item.active,
    });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando cardápio...
      </div>
    );
  }

  const categories = MENU_CATEGORIES.filter((c) => items.some((i) => i.category === c));

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          {items.filter((i) => i.active).length} itens disponíveis. Desmarque &quot;disponível&quot; quando acabar um sabor: a atendente para de oferecer na hora.
        </p>
        {canEdit && (
          <button type="button" onClick={() => setDraft(emptyDraft())} className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Novo item
          </button>
        )}
      </div>

      {items.length === 0 && !error && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2 max-w-xl mx-auto">
          <h2 className="text-sm font-black text-slate-900">Cadastre seu cardápio</h2>
          <p className="text-xs text-slate-500">
            Comece pelas pizzas mais vendidas, com os preços de cada tamanho, e as bebidas. É daqui que a atendente tira os sabores e calcula o valor dos pedidos.
          </p>
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900">{cat}</h2>
            {canEdit && (
              <button type="button" onClick={() => setDraft(emptyDraft(cat))} className="text-[11px] font-bold text-domu-blue">
                + Adicionar em {cat}
              </button>
            )}
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
            {items
              .filter((i) => i.category === cat)
              .map((item) => (
                <div key={item.id} className={`p-3 flex flex-col sm:flex-row sm:items-center gap-2 ${item.active ? '' : 'opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      {item.name}
                      {item.featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                      {item.allows_half && <span className="text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1">meio a meio</span>}
                      {!item.active && <span className="text-[10px] font-bold text-red-600 border border-red-200 rounded px-1">esgotado</span>}
                    </p>
                    {item.description && <p className="text-[11px] text-slate-500 truncate">{item.description}</p>}
                    <p className="text-[11px] text-slate-700 font-semibold">{pricesLabel(item.prices)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggle(item, { active: !item.active })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${item.active ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600'}`}
                      >
                        {item.active ? 'Disponível' : 'Esgotado'}
                      </button>
                      <button type="button" onClick={() => toggle(item, { featured: !item.featured })} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500" aria-label="Mais pedida">
                        <Star className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => edit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-domu-blue" aria-label="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => remove(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500" aria-label="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}

      <ItemModal draft={draft} onClose={() => setDraft(null)} onSaved={load} />
      {confirmDialog}
    </div>
  );
}

type SettingsForm = Omit<PizzeriaSettings, 'delivery_fee' | 'min_order' | 'delivery_areas'> & {
  delivery_fee: string;
  min_order: string;
  delivery_areas: { area: string; fee: string }[];
};

const toForm = (s: PizzeriaSettings): SettingsForm => ({
  ...s,
  delivery_fee: s.delivery_fee ? money(s.delivery_fee) : '',
  min_order: s.min_order ? money(s.min_order) : '',
  delivery_areas: s.delivery_areas.map((a) => ({ area: a.area, fee: a.fee ? money(a.fee) : '' })),
});

function DeliveryTab() {
  const [form, setForm] = useState<SettingsForm>(toForm(DEFAULT_PIZZERIA_SETTINGS));
  const [saved, setSaved] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pizzeria/settings');
        const json = await res.json();
        if (!json.success) {
          setError(json.error || 'Não foi possível carregar.');
          return;
        }
        const f = toForm(json.settings);
        setForm(f);
        setSaved(JSON.stringify(f));
        setCanEdit(Boolean(json.canEdit));
        setOpenNow(json.openNow);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const set = (patch: Partial<SettingsForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setNotice(null);
  };
  const setDay = (i: number, patch: Partial<DayHours>) => set({ weekly_hours: form.weekly_hours.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/pizzeria/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar.');
        return;
      }
      const f = toForm(json.settings);
      setForm(f);
      setSaved(JSON.stringify(f));
      setOpenNow(json.openNow);
      setNotice('Configuração salva. A atendente já usa os novos valores.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }
  const disabled = !canEdit;
  const dirty = JSON.stringify(form) !== saved;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </p>
      )}
      {!canEdit && <p className="text-[11px] text-slate-500">Só administradores podem alterar.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900">Horário de funcionamento</h2>
            {openNow !== null && <span className={`text-[11px] font-bold ${openNow ? 'text-emerald-700' : 'text-slate-500'}`}>{openNow ? 'Aberto agora' : 'Fechado agora'}</span>}
          </div>
          <p className="text-[11px] text-slate-500">Fora do horário a atendente não anota pedido: ela avisa quando abre. Fechamento depois da meia-noite funciona (ex.: 18:00 às 00:30).</p>
          {DISPLAY_ORDER.map((i) => {
            const d = form.weekly_hours[i];
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-2 w-28">
                  <input type="checkbox" checked={d.enabled} disabled={disabled} onChange={(e) => setDay(i, { enabled: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
                  {WEEKDAY_LABELS[i]}
                </label>
                <input type="time" value={d.open} disabled={disabled || !d.enabled} onChange={(e) => setDay(i, { open: e.target.value })} className={`${agendaInputClass} w-28`} />
                <span className="text-slate-400">às</span>
                <input type="time" value={d.close} disabled={disabled || !d.enabled} onChange={(e) => setDay(i, { close: e.target.value })} className={`${agendaInputClass} w-28`} />
              </div>
            );
          })}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">Entrega e retirada</h2>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.delivery_enabled} disabled={disabled} onChange={(e) => set({ delivery_enabled: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
              Fazemos entrega
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.pickup_enabled} disabled={disabled} onChange={(e) => set({ pickup_enabled: e.target.checked })} className="rounded border-slate-300 text-domu-blue" />
              Cliente pode retirar
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Tempo de entrega (min)</span>
              <input type="number" min={5} max={240} value={form.delivery_eta_min} disabled={disabled} onChange={(e) => set({ delivery_eta_min: Number(e.target.value) })} className={agendaInputClass} />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Tempo para retirar (min)</span>
              <input type="number" min={5} max={240} value={form.pickup_eta_min} disabled={disabled} onChange={(e) => set({ pickup_eta_min: Number(e.target.value) })} className={agendaInputClass} />
            </label>
            <label className="space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">Pedido mínimo (R$)</span>
              <input value={form.min_order} disabled={disabled} inputMode="decimal" placeholder="Sem mínimo" onChange={(e) => set({ min_order: e.target.value })} className={agendaInputClass} />
            </label>
            {!form.delivery_areas.length && (
              <label className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-600">Taxa de entrega (R$)</span>
                <input value={form.delivery_fee} disabled={disabled} inputMode="decimal" placeholder="Grátis" onChange={(e) => set({ delivery_fee: e.target.value })} className={agendaInputClass} />
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600">Taxa por bairro (opcional)</span>
            <p className="text-[10.5px] text-slate-400">Com bairros cadastrados, a atendente só aceita entrega nesses bairros, com a taxa de cada um. Sem bairros, vale a taxa única.</p>
            {form.delivery_areas.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={a.area}
                  disabled={disabled}
                  placeholder="Bairro"
                  onChange={(e) => set({ delivery_areas: form.delivery_areas.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)) })}
                  className={`${agendaInputClass} flex-1`}
                />
                <input
                  value={a.fee}
                  disabled={disabled}
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  onChange={(e) => set({ delivery_areas: form.delivery_areas.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)) })}
                  className={`${agendaInputClass} w-24`}
                />
                {!disabled && (
                  <button type="button" onClick={() => set({ delivery_areas: form.delivery_areas.filter((_, j) => j !== i) })} className="p-1 text-slate-400 hover:text-red-500" aria-label="Remover bairro">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button type="button" onClick={() => set({ delivery_areas: [...form.delivery_areas, { area: '', fee: '' }] })} className="text-[11px] font-bold text-domu-blue">
                + Adicionar bairro
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">Meio a meio</h2>
          <label className="block space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">Sabores por pizza</span>
            <select value={form.max_flavors} disabled={disabled} onChange={(e) => set({ max_flavors: Number(e.target.value) })} className={agendaInputClass}>
              <option value={1}>1 (não faz meio a meio)</option>
              <option value={2}>Até 2 sabores</option>
              <option value={3}>Até 3 sabores</option>
              <option value={4}>Até 4 sabores</option>
            </select>
          </label>
          {form.max_flavors > 1 && (
            <div className="flex flex-col gap-1.5 text-xs text-slate-700">
              {(['MAIOR', 'MEDIA'] as const).map((r) => (
                <label key={r} className="flex items-center gap-2">
                  <input type="radio" checked={form.half_half_rule === r} disabled={disabled} onChange={() => set({ half_half_rule: r })} />
                  {HALF_HALF_LABELS[r]}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2">
          <h2 className="text-sm font-black text-slate-900">Aviso ao cliente</h2>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={form.notify_status} disabled={disabled} onChange={(e) => set({ notify_status: e.target.checked })} className="rounded border-slate-300 text-domu-blue mt-0.5" />
            <span>
              Avisar no WhatsApp quando o pedido for aceito, sair para entrega ou ficar pronto.
              <span className="block text-[10.5px] text-slate-400">
                É mensagem de atendimento (dentro das 24h da conversa): a Meta não cobra e não conta no limite de disparos.
              </span>
            </span>
          </label>
          {form.delivery_areas.length > 0 && (
            <p className="text-[11px] text-slate-500">
              Taxas: {form.delivery_areas.filter((a) => a.area).map((a) => `${a.area} ${a.fee ? formatBRL(Number(a.fee.replace(/\./g, '').replace(',', '.'))) : 'grátis'}`).join(' · ')}
            </p>
          )}
        </section>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={!dirty || isSaving} className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar configuração
          </button>
        </div>
      )}
    </div>
  );
}

export default function CardapioPage() {
  const [tab, setTab] = useState<'cardapio' | 'entrega'>('cardapio');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aba') === 'entrega') setTab('entrega');
  }, []);
  return (
    <div className="space-y-4 w-full font-sans">
      <div className="flex gap-1.5 border-b border-slate-200">
        {(
          [
            ['cardapio', 'Cardápio'],
            ['entrega', 'Entrega e horário'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px ${tab === id ? 'border-domu-blue text-domu-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'cardapio' ? <MenuTab /> : <DeliveryTab />}
    </div>
  );
}
