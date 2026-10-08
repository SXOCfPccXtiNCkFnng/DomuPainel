'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';
import { dismissFirstSteps, isFirstStepsDismissed, isFirstStepsForced } from '@/lib/firstSteps';

type Step = {
  title: string;
  detail: string;
  href: string;
  action: string;
  done: boolean;
};

export default function FirstStepsChecklist({
  ready,
  whatsappConnected,
  contactCount,
  templateCount,
  campaignCount,
}: {
  ready: boolean;
  whatsappConnected: boolean;
  contactCount: number;
  templateCount: number;
  campaignCount: number;
}) {
  const [visible, setVisible] = useState(false);
  const tenantId = getAuthItem('domu_tenant_id') || 'local';

  const steps: Step[] = [
    {
      title: 'Conectar o WhatsApp',
      detail: 'Use o número do WhatsApp Business. O pessoal não entra na coexistência.',
      href: '/configuracoes?secao=meta',
      action: 'Abrir conexão',
      done: whatsappConnected,
    },
    {
      title: 'Importar contatos',
      detail: 'Suba uma planilha só com quem autorizou receber mensagens da empresa.',
      href: '/contatos',
      action: 'Importar contatos',
      done: contactCount > 0,
    },
    {
      title: 'Template e primeiro disparo',
      detail: 'A Meta só deixa a empresa iniciar conversa com um template aprovado.',
      href: templateCount > 0 ? '/disparos' : '/templates',
      action: templateCount > 0 ? 'Fazer o disparo' : 'Criar template',
      done: campaignCount > 0,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;

  useEffect(() => {
    if (!ready) return;
    const forced = isFirstStepsForced(tenantId);
    const dismissed = isFirstStepsDismissed(tenantId);
    setVisible(forced || (!dismissed && !allDone));
  }, [ready, tenantId, allDone]);

  if (!visible) return null;

  return (
    <section className="bg-white border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue">
            Primeiros passos · {doneCount} de {steps.length}
          </p>
          <h3 className="text-base font-bold text-slate-900 mt-1">Seu primeiro disparo</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Siga esta ordem. Quando os três estiverem feitos, este quadro some sozinho.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissFirstSteps(tenantId);
            setVisible(false);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-700"
          aria-label="Fechar primeiros passos"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-col sm:flex-row sm:items-center gap-3 border border-slate-200 p-3"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span
                className={`w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold ${
                  step.done ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#0B132B] text-white'
                }`}
              >
                {step.done ? <Check className="w-4 h-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.detail}</p>
              </div>
            </div>
            {step.done ? (
              <span className="text-xs font-bold text-emerald-700 sm:shrink-0">Feito</span>
            ) : (
              <Link
                href={step.href}
                className="btn-domu-primary text-xs py-2 px-3 shrink-0 self-start sm:self-center"
              >
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
