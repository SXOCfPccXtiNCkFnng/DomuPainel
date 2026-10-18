'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Circle, Info, Loader2 } from 'lucide-react';
import WhatsAppPreview from '@/components/shared/WhatsAppPreview';
import {
  ABOUT_MAX,
  ADDRESS_MAX,
  ASSISTANT_NAME_MAX,
  DEFAULT_ASSISTANT_SETTINGS,
  EXTRA_INFO_MAX,
  PAYMENT_OPTIONS,
  sampleGreeting,
  TONE_OPTIONS,
  type AssistantSettings,
} from '@/lib/assistantPrompt';
import type { ServiceItem } from '@/lib/scheduling';
import { agendaInputClass } from './agendaStyles';

const EXTRA_INFO_PLACEHOLDER = `Ex.:
- Não lavamos motor.
- Em dia de chuva, remarcamos sem custo.
- Carro muito sujo (barro, pelo de pet) pode ter valor adicional.
- Temos sala de espera com café e Wi-Fi.`;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[10.5px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function AssistantTab({ services }: { services: ServiceItem[] }) {
  const [form, setForm] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);
  const [saved, setSaved] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);
  const [companyName, setCompanyName] = useState('');
  const [aiAvailable, setAiAvailable] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/assistant/settings');
        const json = await res.json();
        if (!json.success) {
          setError(json.error || 'Não foi possível carregar o assistente.');
          return;
        }
        setForm(json.settings);
        setSaved(json.settings);
        setCompanyName(json.companyName || '');
        setAiAvailable(Boolean(json.aiAvailable));
        setCanEdit(Boolean(json.canEdit));
      } catch {
        setError('Não foi possível carregar o assistente.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<AssistantSettings>) => {
    setForm((f) => ({ ...f, ...patch }));
    setNotice(null);
  };

  const togglePayment = (method: string) =>
    update({
      payment_methods: form.payment_methods.includes(method)
        ? form.payment_methods.filter((m) => m !== method)
        : [...form.payment_methods, method],
    });

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/assistant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível salvar.');
        return;
      }
      setForm(json.settings);
      setSaved(json.settings);
      setNotice('Assistente salvo.');
    } catch {
      setError('Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando assistente...
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const disabled = !canEdit;
  const activeServices = services.filter((s) => s.active).length;
  const knowledge = [
    { done: activeServices > 0, label: activeServices ? `${activeServices} serviços ativos` : 'Nenhum serviço cadastrado' },
    { done: true, label: 'Horário de funcionamento e horários livres da agenda' },
    { done: Boolean(form.address.trim()), label: form.address.trim() ? 'Endereço' : 'Endereço não informado' },
    {
      done: form.payment_methods.length > 0,
      label: form.payment_methods.length ? 'Formas de pagamento' : 'Formas de pagamento não informadas',
    },
    { done: Boolean(form.extra_info.trim()), label: 'Informações e regras da loja' },
  ];

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
      <p className="text-[11px] text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 text-domu-blue" />
        <span>
          A assistente responde seus clientes no WhatsApp como alguém da equipe, focada no lava rápido. Você ajusta o
          jeito dela e o que ela sabe; as regras de atendimento (não inventar preço, só oferecer horário livre,
          confirmar antes de marcar) ficam sempre ligadas.
          {!aiAvailable && ' A chave da IA ainda não está configurada no servidor (GEMINI_API_KEY).'}
        </span>
      </p>
      {!canEdit && <p className="text-[11px] text-slate-500">Só administradores podem alterar o assistente.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-domu-blue" />
              <h2 className="text-sm font-black text-slate-900">Jeito de conversar</h2>
            </div>
            <Field label="Nome da atendente" hint="Opcional. Ex.: Bia, Carol, Rafa.">
              <input
                value={form.assistant_name}
                maxLength={ASSISTANT_NAME_MAX}
                disabled={disabled}
                onChange={(e) => update({ assistant_name: e.target.value })}
                className={agendaInputClass}
              />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Tom</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ tone: t.id })}
                    className={`text-left p-3 rounded-xl border text-xs transition-colors disabled:opacity-60 ${
                      form.tone === t.id
                        ? 'border-domu-blue bg-blue-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-slate-900">{t.label}</span>
                    <span className="block text-[10.5px] text-slate-500 mt-0.5 leading-snug">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.use_emojis}
                  disabled={disabled}
                  onChange={(e) => update({ use_emojis: e.target.checked })}
                  className="rounded border-slate-300 text-domu-blue focus:ring-domu-blue"
                />
                Usar emojis com moderação
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.show_prices}
                  disabled={disabled}
                  onChange={(e) => update({ show_prices: e.target.checked })}
                  className="rounded border-slate-300 text-domu-blue focus:ring-domu-blue"
                />
                Informar preços dos serviços
              </label>
            </div>
            {!form.show_prices && (
              <p className="text-[10.5px] text-slate-500">
                Sem preços, ela explica que o valor depende do carro e é passado pela equipe.
              </p>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <h2 className="text-sm font-black text-slate-900">O que ela sabe sobre a loja</h2>
            <Field label="Sobre a loja" hint={`${form.about.length}/${ABOUT_MAX}`}>
              <textarea
                value={form.about}
                rows={2}
                maxLength={ABOUT_MAX}
                disabled={disabled}
                onChange={(e) => update({ about: e.target.value })}
                placeholder="Ex.: Lava rápido e estética automotiva há 8 anos, especialistas em polimento e vitrificação."
                className={`${agendaInputClass} resize-y`}
              />
            </Field>
            <Field label="Endereço">
              <input
                value={form.address}
                maxLength={ADDRESS_MAX}
                disabled={disabled}
                onChange={(e) => update({ address: e.target.value })}
                placeholder="Ex.: Av. Brasil, 1200 — Centro, Campinas (ao lado do posto)"
                className={agendaInputClass}
              />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-600">Formas de pagamento</span>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={disabled}
                    onClick={() => togglePayment(p)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-60 ${
                      form.payment_methods.includes(p)
                        ? 'bg-domu-blue text-white border-domu-blue'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Informações e regras"
              hint={`Escreva fatos e regras da loja, um por linha. ${form.extra_info.length}/${EXTRA_INFO_MAX}`}
            >
              <textarea
                value={form.extra_info}
                rows={5}
                maxLength={EXTRA_INFO_MAX}
                disabled={disabled}
                onChange={(e) => update({ extra_info: e.target.value })}
                placeholder={EXTRA_INFO_PLACEHOLDER}
                className={`${agendaInputClass} resize-y leading-relaxed`}
              />
            </Field>
          </section>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || isSaving}
                className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar assistente
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
            <h2 className="text-sm font-black text-slate-900">Prévia do tom</h2>
            <WhatsAppPreview
              compact
              bodyText={sampleGreeting(form, companyName || 'sua loja')}
              contactName={companyName || 'Sua loja'}
              companyLabel={form.assistant_name ? `Atendimento · ${form.assistant_name}` : 'Atendimento'}
            />
            <p className="text-[10.5px] text-slate-400">
              Exemplo de saudação. Na conversa real, a IA escreve cada resposta de acordo com o que o cliente disser.
            </p>
          </section>
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2">
            <h2 className="text-sm font-black text-slate-900">Ela vai saber</h2>
            {knowledge.map((k) => (
              <p key={k.label} className={`text-xs flex items-center gap-2 ${k.done ? 'text-slate-700' : 'text-slate-400'}`}>
                {k.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 shrink-0" />
                )}
                {k.label}
              </p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
