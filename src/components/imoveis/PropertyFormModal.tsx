'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Building2, Loader2, X } from 'lucide-react';
import { useBackdropClose, useModalA11y } from '@/hooks/useModalA11y';
import { agendaInputClass } from '@/components/agenda/agendaStyles';
import {
  DESCRIPTION_MAX,
  formatMoneyInput,
  moneyInputValue,
  PROPERTY_PURPOSES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  PURPOSE_LABELS,
  type PropertyPurpose,
  type PropertyStatus,
  type RealEstateProperty,
} from '@/lib/realEstate';

type FormState = {
  code: string;
  title: string;
  type: string;
  purpose: PropertyPurpose;
  status: PropertyStatus;
  price: string;
  rent_price: string;
  condo_fee: string;
  neighborhood: string;
  city: string;
  bedrooms: string;
  bathrooms: string;
  parking_spots: string;
  area_sqm: string;
  features: string;
  description: string;
  link_url: string;
};

const EMPTY: FormState = {
  code: '',
  title: '',
  type: 'Apartamento',
  purpose: 'VENDA',
  status: 'Disponível',
  price: '',
  rent_price: '',
  condo_fee: '',
  neighborhood: '',
  city: '',
  bedrooms: '',
  bathrooms: '',
  parking_spots: '',
  area_sqm: '',
  features: '',
  description: '',
  link_url: '',
};

const numText = (v: number | null | undefined) => (v ? String(v) : '');

function fromProperty(p: RealEstateProperty): FormState {
  return {
    code: p.code,
    title: p.title,
    type: p.type,
    purpose: p.purpose,
    status: p.status,
    price: moneyInputValue(p.price),
    rent_price: moneyInputValue(p.rent_price),
    condo_fee: moneyInputValue(p.condo_fee),
    neighborhood: p.neighborhood || '',
    city: p.city || '',
    bedrooms: numText(p.bedrooms),
    bathrooms: numText(p.bathrooms),
    parking_spots: numText(p.parking_spots),
    area_sqm: numText(p.area_sqm),
    features: p.features.join(', '),
    description: p.description || '',
    link_url: p.link_url || '',
  };
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className || ''}`}>
      <span className="block text-[11px] font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[10.5px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function PropertyFormModal({
  isOpen,
  property,
  defaultCity,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  /** Imóvel para editar; vazio = cadastro novo. */
  property: RealEstateProperty | null;
  defaultCity?: string;
  onClose: () => void;
  onSaved: (property: RealEstateProperty) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);
  const backdropProps = useBackdropClose(onClose);

  useEffect(() => {
    if (!isOpen) return;
    setForm(property ? fromProperty(property) : { ...EMPTY, city: defaultCity || '' });
    setError(null);
  }, [isOpen, property, defaultCity]);

  if (!isOpen || typeof document === 'undefined') return null;

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/properties', {
        method: property ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property ? { id: property.id, ...form } : form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar o imóvel.');
        return;
      }
      onSaved(json.property);
      onClose();
    } catch {
      setError('Não foi possível salvar o imóvel.');
    } finally {
      setIsSaving(false);
    }
  };

  const priceLabel = form.purpose === 'ALUGUEL' ? 'Aluguel (R$/mês)' : 'Valor de venda (R$)';

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      {...backdropProps}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-form-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="property-form-title" className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-domu-blue" />
            {property ? 'Editar imóvel' : 'Cadastrar imóvel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            A atendente usa exatamente o que estiver aqui para responder os clientes. O que ficar em branco ela não
            inventa: diz que o corretor confirma.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Título" className="sm:col-span-2">
              <input
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Ex.: Apartamento 2 quartos com varanda no Centro"
                className={agendaInputClass}
                required
              />
            </Field>
            <Field label="Código" hint="Vazio = gerado sozinho">
              <input
                value={form.code}
                onChange={(e) => update({ code: e.target.value })}
                placeholder="Ex.: AP-102"
                className={agendaInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => update({ type: e.target.value })} className={agendaInputClass}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Finalidade">
              <select
                value={form.purpose}
                onChange={(e) => update({ purpose: e.target.value as PropertyPurpose })}
                className={agendaInputClass}
              >
                {PROPERTY_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {PURPOSE_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Situação">
              <select
                value={form.status}
                onChange={(e) => update({ status: e.target.value as PropertyStatus })}
                className={agendaInputClass}
              >
                {PROPERTY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={priceLabel}>
              <input
                inputMode="decimal"
                value={form.price}
                onChange={(e) => update({ price: formatMoneyInput(e.target.value) })}
                placeholder={form.purpose === 'ALUGUEL' ? 'Ex.: 2.500' : 'Ex.: 450.000'}
                className={agendaInputClass}
                required
              />
            </Field>
            {form.purpose === 'VENDA_E_ALUGUEL' && (
              <Field label="Aluguel (R$/mês)">
                <input
                  inputMode="decimal"
                  value={form.rent_price}
                  onChange={(e) => update({ rent_price: formatMoneyInput(e.target.value) })}
                  placeholder="Ex.: 2.500"
                  className={agendaInputClass}
                  required
                />
              </Field>
            )}
            <Field label="Condomínio (R$/mês)" hint="Opcional">
              <input
                inputMode="decimal"
                value={form.condo_fee}
                onChange={(e) => update({ condo_fee: formatMoneyInput(e.target.value) })}
                placeholder="Ex.: 450"
                className={agendaInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Bairro">
              <input
                value={form.neighborhood}
                onChange={(e) => update({ neighborhood: e.target.value })}
                placeholder="Ex.: Jardim Botânico"
                className={agendaInputClass}
              />
            </Field>
            <Field label="Cidade">
              <input
                value={form.city}
                onChange={(e) => update({ city: e.target.value })}
                placeholder="Ex.: Ribeirão Preto"
                className={agendaInputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Quartos">
              <input inputMode="numeric" value={form.bedrooms} onChange={(e) => update({ bedrooms: e.target.value })} className={agendaInputClass} />
            </Field>
            <Field label="Banheiros">
              <input inputMode="numeric" value={form.bathrooms} onChange={(e) => update({ bathrooms: e.target.value })} className={agendaInputClass} />
            </Field>
            <Field label="Vagas">
              <input inputMode="numeric" value={form.parking_spots} onChange={(e) => update({ parking_spots: e.target.value })} className={agendaInputClass} />
            </Field>
            <Field label="Área (m²)">
              <input inputMode="decimal" value={form.area_sqm} onChange={(e) => update({ area_sqm: e.target.value })} className={agendaInputClass} />
            </Field>
          </div>

          <Field label="Destaques" hint="Separe por vírgula. Ex.: varanda gourmet, piscina, aceita pet, mobiliado">
            <input
              value={form.features}
              onChange={(e) => update({ features: e.target.value })}
              className={agendaInputClass}
            />
          </Field>

          <Field label="Descrição" hint={`O que um corretor contaria sobre o imóvel. ${form.description.length}/${DESCRIPTION_MAX}`}>
            <textarea
              value={form.description}
              rows={4}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Ex.: Andar alto, sol da manhã, prédio com portaria 24h. Próximo ao shopping. Lançamento com entrega em dez/2027."
              className={`${agendaInputClass} resize-y leading-relaxed`}
            />
          </Field>

          <Field label="Link do anúncio com fotos" hint="Site da imobiliária, portal ou álbum. A atendente manda esse link ao cliente.">
            <input
              value={form.link_url}
              onChange={(e) => update({ link_url: e.target.value })}
              placeholder="https://..."
              className={agendaInputClass}
            />
          </Field>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-domu-primary text-xs py-2 px-5 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {property ? 'Salvar alterações' : 'Cadastrar imóvel'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
