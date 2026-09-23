import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidade | Domu Tech',
  description: 'Política de Privacidade e Proteção de Dados da Domu Tech.',
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <Link href="/" className="text-amber-500 text-sm font-semibold hover:underline">
            &larr; Voltar para Domu Tech
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-xs text-slate-400 mt-1">Última atualização: Setembro de 2026</p>
        </div>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Introdução</h2>
          <p>
            A <strong>Domu Tech</strong> valoriza a sua privacidade e está comprometida em proteger
            os dados pessoais de seus clientes e usuários em conformidade com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 - LGPD) e as políticas da Meta Platforms Inc.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">2. Dados Coletados</h2>
          <p>
            Para possibilitar o funcionamento da plataforma de gestão imobiliária e mensageria via WhatsApp Cloud API,
            coletamos apenas as informações estritamente necessárias:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Nome e e-mail cadastrais da conta comercial.</li>
            <li>Identificadores comerciais do WhatsApp (WABA ID e Phone Number ID) concedidos voluntariamente pelo usuário.</li>
            <li>Contatos/leads importados pelo próprio usuário para fins de atendimento e envio de comunicados autorizados (opt-in).</li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">3. Uso dos Dados e Integração com a Meta</h2>
          <p>
            Os dados recebidos via WhatsApp Business Cloud API são utilizados única e exclusivamente para a prestação dos serviços
            contratados pelo cliente (envio de modelos de mensagem aprovados, gestão de mensagens e métricas). Não vendemos, não
            compartilhamos e não monetizamos dados pessoais com terceiros.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">4. Exclusão e Retenção de Dados</h2>
          <p>
            O titular dos dados pode a qualquer momento solicitar a exclusão definitiva de seus dados e revogação de acessos.
            Para solicitar a exclusão de dados de usuário, basta entrar em contato pelo e-mail{' '}
            <strong className="text-amber-400">suporte@domutech.digital</strong> informando o e-mail ou número de telefone associado.
            Após a solicitação, os registros serão permanentemente removidos de nossas bases em até 72 horas úteis.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-semibold text-white">5. Contato do Encarregado (DPO)</h2>
          <p>
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de dados pessoais, entre em contato através do e-mail:{' '}
            <strong className="text-amber-400">privacidade@domutech.digital</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
