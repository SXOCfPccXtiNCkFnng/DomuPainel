import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Termos de Serviço | Domu Tech',
  description: 'Termos de Serviço e Condições de Uso da plataforma Domu Tech.',
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <Link href="/" className="text-amber-500 text-sm font-semibold hover:underline">
            &larr; Voltar para Domu Tech
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">Termos de Serviço</h1>
          <p className="text-xs text-slate-400 mt-1">Última atualização: Setembro de 2026</p>
        </div>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar os serviços da plataforma <strong>Domu Tech</strong>, você concorda expressamente em cumprir
            integralmente estes Termos de Serviço e todas as normas aplicáveis, incluindo os Termos da Plataforma WhatsApp Business da Meta.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">2. Uso Adequado da Plataforma</h2>
          <p>
            A Domu Tech disponibiliza ferramentas de mensageria para o setor imobiliário. O usuário se compromete a:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Enviar mensagens apenas para contatos que concederam consentimento prévio (opt-in).</li>
            <li>Respeitar as políticas contra spam, práticas enganosas e conteúdos ofensivos.</li>
            <li>Cumprir a Política Comercial e a Política de Negócios do WhatsApp da Meta.</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">3. Responsabilidades</h2>
          <p>
            O usuário é o único responsável pela veracidade dos dados cadastrados e pelo conteúdo dos modelos de mensagem
            submetidos para aprovação junto à Meta. O uso inadequado que resulte em denúncias ou suspensão de linha é de responsabilidade do contratante.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">4. Contato</h2>
          <p>
            Para suporte, dúvidas ou esclarecimentos sobre estes Termos de Serviço, contate nossa equipe em:{' '}
            <strong className="text-amber-400">suporte@domutech.digital</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
