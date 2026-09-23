import React from 'react';
import Link from 'next/link';
import { TermsBody } from '@/components/shared/LegalDocumentModal';
import { LEGAL_DOCS_VERSION } from '@/lib/legal';

export const metadata = {
  title: 'Termos de Uso | Domu Tech',
  description: 'Termos de Uso e Condições da plataforma Domu Tech.',
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-amber-400 text-sm font-semibold hover:underline">
            &larr; Voltar para o Portal
          </Link>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            Versão {LEGAL_DOCS_VERSION}
          </span>
        </div>

        <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-6 border border-slate-200">
          <div className="border-b border-slate-200 pb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Termos de Uso — Domu Tech
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Plataforma de automação e mensageria WhatsApp para o setor imobiliário
            </p>
          </div>

          <div className="text-sm text-slate-700 leading-relaxed space-y-6">
            <TermsBody />
          </div>
        </div>
      </div>
    </main>
  );
}
