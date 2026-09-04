'use client';

import React from 'react';
import { LEGAL_DOCS_VERSION } from '@/lib/legal';
import { CONTACT_EMAIL } from '@/lib/contact';

export type LegalDoc = 'terms' | 'privacy';

function TermsBody() {
  return (
    <>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">1. Aceitação</h4>
        <p>
          Estes Termos de Uso regem o acesso e uso do Portal Domu Tech (&quot;Portal&quot;), plataforma de
          automação e gestão de atendimento via WhatsApp. Ao criar uma conta, contratar um plano ou usar o
          Portal, você declara ter lido, compreendido e aceito integralmente estes termos.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">2. Descrição do serviço</h4>
        <p>
          O Portal oferece ferramentas de disparo de mensagens, automação de atendimento, gestão de contatos
          (leads) e relatórios, integradas à WhatsApp Business Platform (Meta Cloud API). O Portal depende de
          serviços de terceiros — Meta (WhatsApp), Asaas (pagamentos) e provedores de e-mail — cuja
          disponibilidade não está sob nosso controle.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Cadastro e conta</h4>
        <p>
          Você é responsável pela veracidade dos dados cadastrados, pela guarda de sua senha e por toda
          atividade realizada com sua conta. Contas são de uso da empresa (tenant) contratante; usuários
          adicionais (corretores, atendentes) podem ser convidados pelo administrador da conta, que responde
          pelo uso feito por sua equipe.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">4. Uso aceitável e anti-spam</h4>
        <p>
          É obrigatório obter <strong>opt-in válido</strong> (consentimento prévio) antes de enviar mensagens
          comerciais a qualquer contato. É proibido usar o Portal para spam, phishing, conteúdo ilegal,
          discurso de ódio ou qualquer prática que viole as políticas da WhatsApp Business Platform. O
          descumprimento pode levar ao bloqueio do número pela Meta — evento fora do nosso controle — e à
          suspensão da conta no Portal, sem reembolso de valores já pagos no período.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">5. Planos, cobrança e cancelamento</h4>
        <p>
          A assinatura é mensal, recorrente e cobrada via Asaas (PIX ou cartão de crédito), conforme o plano
          escolhido. Limites de disparo e recursos seguem a tabela vigente no Portal. O cancelamento pode ser
          solicitado a qualquer momento e produz efeito ao final do período já pago; não há reembolso
          proporcional de período já iniciado, salvo obrigação legal em contrário. Taxas cobradas diretamente
          pela Meta (ex.: conversas iniciadas por template fora da janela gratuita) são de responsabilidade do
          contratante, diretamente junto à Meta.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">6. Propriedade intelectual</h4>
        <p>
          O software, marca, layout e demais elementos do Portal são de propriedade da Domu Tech. O uso do
          Portal não transfere qualquer direito de propriedade intelectual ao contratante. Os dados inseridos
          pelo contratante (leads, templates, mensagens) permanecem de sua titularidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">7. Limitação de responsabilidade</h4>
        <p>
          O Portal é fornecido &quot;como está&quot;. Não garantimos disponibilidade ininterrupta, nem nos
          responsabilizamos por indisponibilidade, bloqueio ou alteração de política por parte da Meta, Asaas
          ou outros provedores terceiros. Nossa responsabilidade, quando aplicável, está limitada ao valor
          pago pelo contratante nos 3 (três) meses anteriores ao evento.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">8. Suspensão e rescisão</h4>
        <p>
          Podemos suspender ou encerrar contas em caso de inadimplência, uso indevido ou violação destes
          termos, mediante aviso prévio quando possível. Dados poderão ser mantidos pelo período necessário
          para cumprimento de obrigações legais/fiscais e depois excluídos, conforme nossa Política de
          Privacidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">9. Alterações destes termos</h4>
        <p>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas no Portal antes
          de exigirem novo aceite. O uso continuado após a atualização implica concordância com a nova versão.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Lei aplicável e foro</h4>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do
          domicílio do contratante para dirimir eventuais controvérsias, salvo disposição legal em contrário.
        </p>
      </section>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">1. Controlador dos dados</h4>
        <p>
          A Domu Tech é a controladora dos dados pessoais tratados através do Portal, nos termos da Lei
          13.709/2018 (LGPD). Dúvidas ou solicitações sobre privacidade podem ser enviadas para{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-domu-blue hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">2. Dados que coletamos</h4>
        <p>Coletamos e tratamos, principalmente:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Dados de conta: nome, e-mail, telefone e senha (armazenada como hash, nunca em texto puro).</li>
          <li>Dados da empresa: razão comercial, segmento de atuação, número de WhatsApp.</li>
          <li>Dados de cobrança: CPF/CNPJ e histórico de pagamento, processados pelo Asaas.</li>
          <li>
            Dados de contatos (leads) importados ou cadastrados pelo contratante, sob responsabilidade dele
            quanto à origem e ao consentimento (opt-in) desses contatos.
          </li>
          <li>Dados de uso do Portal (logs de acesso, campanhas enviadas, métricas de entrega).</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Como usamos os dados</h4>
        <p>
          Usamos os dados para: operar o Portal e suas funcionalidades; processar pagamentos; enviar
          comunicações operacionais (confirmação de conta, redefinição de senha, avisos de cobrança); cumprir
          obrigações legais e fiscais; e melhorar a segurança e a qualidade do serviço. Não usamos os dados
          para publicidade de terceiros.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">4. Com quem compartilhamos</h4>
        <p>Compartilhamos dados apenas com operadores estritamente necessários à operação do serviço:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Meta (WhatsApp Business Platform)</strong> — envio e recebimento de mensagens.</li>
          <li><strong>Asaas</strong> — processamento de pagamentos (PIX/cartão) e emissão de cobranças.</li>
          <li><strong>Supabase</strong> — hospedagem do banco de dados e infraestrutura.</li>
          <li><strong>Provedor de e-mail transacional</strong> — envio de e-mails de conta (convites, recuperação de senha).</li>
        </ul>
        <p>Não vendemos dados de clientes ou de leads a terceiros.</p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">5. Como protegemos os dados</h4>
        <p>
          Senhas são armazenadas com hash bcrypt (irreversível). Credenciais de integração com o WhatsApp
          (tokens de acesso) são criptografadas com AES-256-GCM antes de serem gravadas no banco. O acesso
          direto ao banco de dados é restrito; toda a aplicação passa por controle de sessão e permissões por
          perfil (administrador, corretor, atendente).
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">6. Retenção e exclusão</h4>
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações
          legais/fiscais após o encerramento (ex.: registros de cobrança). Você pode solicitar a exclusão dos
          dados da sua conta a qualquer momento pelo canal de contato abaixo, respeitadas as retenções
          legalmente obrigatórias.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">7. Seus direitos (LGPD)</h4>
        <p>
          Nos termos do art. 18 da LGPD, você pode solicitar: confirmação de tratamento, acesso, correção,
          anonimização, portabilidade, eliminação de dados e revogação do consentimento. Para exercer esses
          direitos, entre em contato pelo e-mail{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-domu-blue hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">8. Cookies e sessão</h4>
        <p>
          Usamos apenas um cookie técnico, essencial para manter sua sessão autenticada (HttpOnly, não
          acessível via JavaScript). Não utilizamos cookies de rastreamento, publicidade ou analytics de
          terceiros.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">9. Alterações desta política</h4>
        <p>
          Podemos atualizar esta Política periodicamente. A data da versão vigente é exibida no rodapé deste
          documento. Alterações relevantes serão comunicadas no Portal.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Contato</h4>
        <p>
          Para qualquer dúvida sobre este documento ou sobre o tratamento dos seus dados, escreva para{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-domu-blue hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </>
  );
}

const DOC_META: Record<LegalDoc, { title: string }> = {
  terms: { title: 'Termos de Uso' },
  privacy: { title: 'Política de Privacidade' },
};

export function LegalDocumentModal({
  doc,
  onClose,
  onAccept,
}: {
  doc: LegalDoc | null;
  onClose: () => void;
  onAccept?: () => void;
}) {
  if (!doc) return null;
  const meta = DOC_META[doc];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
      <div className="bg-white w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{meta.title}</h3>
            <p className="text-sm text-slate-500">Domu Tech · versão {LEGAL_DOCS_VERSION}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          {doc === 'terms' ? <TermsBody /> : <PrivacyBody />}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Voltar
          </button>
          {onAccept ? (
            <button
              type="button"
              onClick={onAccept}
              className="btn-domu-primary text-sm py-2.5 px-5"
            >
              Aceitar e continuar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
