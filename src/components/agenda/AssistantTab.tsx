'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Circle, Headset, Info, Loader2, Megaphone } from 'lucide-react';
import WhatsAppPreview from '@/components/shared/WhatsAppPreview';
import {
  ABOUT_MAX,
  ADDRESS_MAX,
  ASSISTANT_NAME_MAX,
  ASSISTANT_NAME_SUGGESTIONS,
  activePromo,
  DEFAULT_ASSISTANT_SETTINGS,
  EXTRA_INFO_MAX,
  formatPromoUntil,
  GREETING_MAX,
  PAYMENT_OPTIONS,
  PROMO_MAX,
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

export default function AssistantTab({
  services,
  onGoToServices,
}: {
  services: ServiceItem[];
  onGoToServices?: () => void;
}) {
  const [form, setForm] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);
  const [saved, setSaved] = useState<AssistantSettings>(DEFAULT_ASSISTANT_SETTINGS);
  const [companyName, setCompanyName] = useState('');
  const [aiAvailable, setAiAvailable] = useState(true);
  const [promoAvailable, setPromoAvailable] = useState(true);
  const [quota, setQuota] = useState<{ planName: string; limit: number; used: number } | null>(null);
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
          setError(json.error || 'Não foi possível carregar a atendente.');
          return;
        }
        setForm(json.settings);
        setSaved(json.settings);
        setCompanyName(json.companyName || '');
        setAiAvailable(Boolean(json.aiAvailable));
        setQuota(json.quota || null);
        setPromoAvailable(json.promoAvailable !== false);
        setCanEdit(Boolean(json.canEdit));
      } catch {
        setError('Não foi possível carregar a atendente.');
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
      setNotice('Atendente salva.');
    } catch {
      setError('Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando atendente...
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
    {
      done: Boolean(activePromo(form)),
      label: activePromo(form) ? 'Promoção em andamento' : 'Nenhuma promoção ativa',
    },
  ];

  const promoExpired = Boolean(form.promo_text.trim() && !activePromo(form));
  const promoStatus = promoExpired
    ? { text: `Venceu em ${formatPromoUntil(form.promo_until)}: a atendente não oferece mais.`, tone: 'text-red-600' }
    : form.promo_until
      ? { text: `A atendente oferece até ${formatPromoUntil(form.promo_until)} e depois para sozinha.`, tone: 'text-emerald-700' }
      : { text: 'Sem data: vale até você remover.', tone: 'text-slate-500' };

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
          A atendente responde seus clientes no WhatsApp como alguém da equipe, focada no lava rápido. Você ajusta o
          jeito dela e o que ela sabe; as regras de atendimento (não inventar preço, só oferecer horário livre,
          confirmar antes de marcar) ficam sempre ligadas.
          {!aiAvailable && ' A atendente ainda não foi liberada no servidor (falta a GEMINI_API_KEY).'}
        </span>
      </p>
      {!canEdit && <p className="text-[11px] text-slate-500">Só administradores podem alterar a atendente.</p>}

      <section
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${
          form.enabled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200/80'
        }`}
      >
        <div className="flex-1 space-y-1">
          <h2 className="text-sm font-black text-slate-900">
            {form.enabled ? 'Atendente ligada no WhatsApp' : 'Atendente desligada'}
          </h2>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {form.enabled
              ? 'Ela responde a qualquer hora e marca horários sozinha. Quando alguém da equipe responde pelo celular, ela fica quieta naquela conversa por 12 horas. Se o cliente reclamar ou pedir uma pessoa, ela avisa você aqui no painel e por e-mail.'
              : 'Ligue para ela começar a responder as mensagens que chegarem no WhatsApp conectado.'}
          </p>
          {!form.enabled && activeServices === 0 && (
            <p className="text-[11px] text-amber-700">
              Cadastre pelo menos um serviço antes de ligar.{' '}
              {onGoToServices && (
                <button type="button" onClick={onGoToServices} className="font-bold underline">
                  Cadastrar serviços
                </button>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.enabled}
          disabled={disabled || !aiAvailable || (!form.enabled && activeServices === 0)}
          onClick={() => update({ enabled: !form.enabled })}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            form.enabled ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              form.enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </section>
      {form.enabled !== saved.enabled && (
        <p className="text-[11px] text-amber-700">Clique em “Salvar atendente” para aplicar.</p>
      )}

      {quota && (
        <section className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-black text-slate-900">Conversas da atendente neste mês</h2>
            <span className="text-xs font-bold text-slate-700">
              {quota.used.toLocaleString('pt-BR')} de {quota.limit.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                quota.used >= quota.limit ? 'bg-red-500' : quota.used >= quota.limit * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
            />
          </div>
          <p className="text-[10.5px] text-slate-500 leading-relaxed">
            {quota.used >= quota.limit
              ? 'As conversas do mês acabaram: contatos novos ficam com a sua equipe até o dia 1º. '
              : ''}
            Cada contato atendido num dia conta como uma conversa, não importa quantas mensagens troquem. Plano{' '}
            {quota.planName}.{' '}
            <Link href="/assinatura" className="font-bold text-domu-blue underline">
              Ver planos
            </Link>
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Headset className="w-4 h-4 text-domu-blue" />
              <h2 className="text-sm font-black text-slate-900">Jeito de conversar</h2>
            </div>
            <div className="space-y-1.5">
              <Field label="Nome da atendente" hint="Escolha uma sugestão ou escreva outro nome. Pode deixar vazio.">
                <input
                  value={form.assistant_name}
                  maxLength={ASSISTANT_NAME_MAX}
                  disabled={disabled}
                  onChange={(e) => update({ assistant_name: e.target.value })}
                  className={agendaInputClass}
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {ASSISTANT_NAME_SUGGESTIONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ assistant_name: name })}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-60 ${
                      form.assistant_name === name
                        ? 'bg-domu-blue text-white border-domu-blue'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
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
              label="Informações e regras (fixas)"
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

          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-domu-blue" />
              <h2 className="text-sm font-black text-slate-900">Boas-vindas e promoção</h2>
            </div>
            {!promoAvailable && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Ainda não disponível nesta conta (atualização do banco pendente). Os outros campos funcionam normalmente.
              </p>
            )}
            <Field
              label="Mensagem de boas-vindas"
              hint={`Opcional. A atendente usa no começo de cada conversa. ${form.greeting.length}/${GREETING_MAX}`}
            >
              <textarea
                value={form.greeting}
                rows={2}
                maxLength={GREETING_MAX}
                disabled={disabled || !promoAvailable}
                onChange={(e) => update({ greeting: e.target.value })}
                placeholder={`Ex.: Oi! Aqui é ${form.assistant_name || 'a Bia'}, da ${companyName || 'sua loja'}. Seu carro merece um trato hoje? Como posso te ajudar?`}
                className={`${agendaInputClass} resize-y`}
              />
            </Field>
            <Field
              label="Promoção"
              hint={`Escreva o que é, o valor e as condições. A atendente só oferece exatamente isso. ${form.promo_text.length}/${PROMO_MAX}`}
            >
              <textarea
                value={form.promo_text}
                rows={3}
                maxLength={PROMO_MAX}
                disabled={disabled || !promoAvailable}
                onChange={(e) => update({ promo_text: e.target.value })}
                placeholder="Ex.: Lavagem completa + cera por R$ 70,00, de segunda a quarta. Não vale para caminhonete."
                className={`${agendaInputClass} resize-y`}
              />
            </Field>
            {form.promo_text.trim() && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Válida até (inclusive)">
                  <input
                    type="date"
                    value={form.promo_until}
                    disabled={disabled || !promoAvailable}
                    onChange={(e) => update({ promo_until: e.target.value })}
                    className={`${agendaInputClass} w-44`}
                  />
                </Field>
                <p className={`text-[11px] pb-2 ${promoStatus.tone}`}>{promoStatus.text}</p>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => update({ promo_text: '', promo_until: '' })}
                    className="text-[11px] font-bold text-red-600 hover:underline pb-2 ml-auto"
                  >
                    Remover promoção
                  </button>
                )}
              </div>
            )}
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
                Salvar atendente
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
              Exemplo de saudação. Na conversa real, a atendente escreve cada resposta de acordo com o que o cliente disser.
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
