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
          Estes Termos de Uso regem o acesso e uso da Plataforma Domu Tech (&quot;Plataforma&quot;), sistema de
          automação e gestão de atendimento via WhatsApp. Ao criar uma conta, contratar um plano ou usar a
          Plataforma, você declara ter lido, compreendido e aceito integralmente estes termos.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">2. Descrição do serviço</h4>
        <p>
          A Plataforma oferece ferramentas de disparo de mensagens, automação de atendimento, gestão de contatos
          (leads) e relatórios, integradas à WhatsApp Business Platform (Meta Cloud API). A Plataforma depende de
          serviços de terceiros — Meta (WhatsApp), Asaas (pagamentos) e provedores de e-mail — cuja
          disponibilidade não está sob nosso controle.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Cadastro, conta e segurança de acesso</h4>
        <p>
          Você é responsável pela veracidade dos dados cadastrados, pela guarda de sua senha e por toda
          atividade realizada com sua conta. Contas são de uso da empresa (tenant) contratante; usuários
          adicionais (corretores, atendentes) podem ser convidados pelo administrador da conta, que responde
          pelo uso feito por sua equipe.
        </p>
        <p>
          O login e a senha de acesso são <strong>pessoais e intransferíveis</strong>. Você se compromete a
          manter o sigilo de suas credenciais e a não compartilhá-las com terceiros, incluindo colaboradores
          que devam ter acesso próprio (nesse caso, use o convite de equipe da Plataforma, que cria uma conta
          individual com permissões próprias, em vez de compartilhar seu login). Não é possível alegar uso
          indevido da conta após ato de compartilhamento, negligência ou imperícia do contratante ou de sua
          equipe em manter as credenciais seguras — toda atividade realizada com credenciais válidas é
          presumida como autorizada pelo contratante.
        </p>
        <p>
          Quando disponibilizarmos recomendações de segurança (ex.: senha forte, autenticação em duas etapas,
          revisão periódica de quem tem acesso à conta, remoção de usuários que saíram da equipe), é sua
          responsabilidade adotá-las. O não cumprimento de recomendações de segurança comunicadas por nós
          isenta a Domu Tech de responsabilidade por incidentes que decorram diretamente dessa omissão.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">4. Uso aceitável, anti-spam e responsabilidade sobre dados de terceiros</h4>
        <p>
          É obrigatório obter <strong>opt-in válido</strong> (consentimento prévio) ou outra base legal prevista
          na LGPD antes de enviar mensagens comerciais a qualquer contato. É proibido usar a Plataforma para
          spam, phishing, conteúdo ilegal, discurso de ódio, aquisição de listas de contatos de origem duvidosa
          ou qualquer prática que viole as políticas da WhatsApp Business Platform. O descumprimento pode levar
          ao bloqueio do número pela Meta — evento fora do nosso controle — e à suspensão da conta na
          Plataforma, sem reembolso de valores já pagos no período.
        </p>
        <p>
          Para os dados de contatos, leads e demais dados pessoais de terceiros que você insere, importa ou
          cadastra na Plataforma, <strong>você atua como controlador desses dados perante a LGPD</strong> e
          declara possuir base legal válida (consentimento, legítimo interesse ou outra hipótese do art. 7º da
          Lei 13.709/2018) para coletá-los e tratá-los. Você se compromete a indenizar e manter a Domu Tech
          isenta de qualquer reclamação, multa, indenização ou dano decorrente de dados inseridos na Plataforma
          sem base legal adequada, obtidos de forma ilícita, ou tratados em desacordo com os direitos dos
          titulares — a Domu Tech atua como operadora desses dados, processando-os conforme suas instruções,
          sem verificar a origem ou a licitude da coleta feita por você.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">5. Planos, cobrança e cancelamento</h4>
        <p>
          A assinatura é mensal, recorrente e cobrada via Asaas (PIX ou cartão de crédito), conforme o plano
          escolhido. Limites de disparo e recursos seguem a tabela vigente na Plataforma. O cancelamento pode ser
          solicitado a qualquer momento e produz efeito ao final do período já pago; não há reembolso
          proporcional de período já iniciado, salvo obrigação legal em contrário. Taxas cobradas diretamente
          pela Meta (ex.: conversas iniciadas por template fora da janela gratuita) são de responsabilidade do
          contratante, diretamente junto à Meta. Os preços dos planos podem ser reajustados; para quem já é
          assinante, qualquer reajuste é comunicado por e-mail com no mínimo 30 dias de antecedência antes de
          entrar em vigor na cobrança, e o cancelamento sem ônus pode ser feito a qualquer momento antes disso.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">6. Propriedade intelectual</h4>
        <p>
          O software, marca, layout e demais elementos da Plataforma são de propriedade da Domu Tech. O uso da
          Plataforma não transfere qualquer direito de propriedade intelectual ao contratante. Os dados inseridos
          pelo contratante (leads, templates, mensagens) permanecem de sua titularidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">7. Limitação de responsabilidade</h4>
        <p>
          A Plataforma é fornecida &quot;como está&quot;. Não garantimos disponibilidade ininterrupta, nem nos
          responsabilizamos por indisponibilidade, bloqueio ou alteração de política por parte da Meta, Asaas
          ou outros provedores terceiros. Nossa responsabilidade, quando aplicável, está limitada ao valor
          pago pelo contratante nos 3 (três) meses anteriores ao evento, exceto nos casos em que a lei
          brasileira não admita tal limitação (ex.: dolo ou culpa grave da Domu Tech).
        </p>
        <p>
          Sem prejuízo do disposto na Política de Privacidade, a Domu Tech <strong>não se responsabiliza</strong>{' '}
          por incidentes de segurança, vazamento ou perda de dados que decorram, total ou parcialmente, de:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Uso de senha fraca, reutilizada em outros serviços, ou compartilhamento de credenciais pelo contratante ou por sua equipe;</li>
          <li>Não adoção de recomendações de segurança comunicadas pela Domu Tech (item 3);</li>
          <li>Concessão de acesso à conta a pessoas não autorizadas ou à ex-colaboradores não removidos pelo administrador da conta;</li>
          <li>Dispositivos, redes ou softwares de terceiros utilizados pelo contratante para acessar a Plataforma que estejam comprometidos (vírus, malware, phishing dirigido ao usuário);</li>
          <li>Dados inseridos na Plataforma sem base legal adequada, conforme item 4;</li>
          <li>Ações de terceiros fora do controle da Domu Tech, incluindo falhas de segurança da Meta, do Asaas ou de outros provedores integrados.</li>
        </ul>
        <p>
          Nesses casos, a responsabilidade pelo incidente e por eventuais danos a titulares de dados ou a
          terceiros é exclusiva do contratante, que se compromete a indenizar a Domu Tech por quaisquer
          prejuízos, multas ou despesas (incluindo honorários advocatícios) decorrentes.
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
        <h4 className="font-bold text-slate-900">9. Incidentes de segurança</h4>
        <p>
          Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares de
          dados, a Domu Tech comunicará o contratante em prazo razoável, conforme exigido pelo art. 48 da LGPD,
          informando a natureza dos dados afetados, as medidas técnicas adotadas e as orientações para
          mitigação de riscos. Quando o incidente decorrer de causa listada no item 7 (culpa do contratante),
          cabe a ele, na qualidade de controlador dos dados de terceiros afetados, avaliar e cumprir o dever de
          comunicação à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares, conforme aplicável.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Alterações destes termos</h4>
        <p>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas na Plataforma antes
          de exigirem novo aceite. O uso continuado após a atualização implica concordância com a nova versão.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">11. Lei aplicável e foro</h4>
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
        <h4 className="font-bold text-slate-900">1. Controlador e operador dos dados</h4>
        <p>
          A Domu Tech atua como <strong>controladora</strong> dos dados pessoais do contratante e de sua
          equipe (dados de conta, cadastro e cobrança), nos termos da Lei 13.709/2018 (LGPD). Já em relação
          aos dados de contatos e leads que o contratante insere, importa ou cadastra na Plataforma, a Domu
          Tech atua como <strong>operadora</strong> — trata esses dados apenas conforme as instruções do
          contratante, que é o controlador responsável por sua origem, licitude e base legal (ver item 4 dos
          Termos de Uso). Dúvidas ou solicitações sobre privacidade podem ser enviadas para{' '}
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
            Dados de contatos (leads) importados ou cadastrados pelo contratante, sob responsabilidade{' '}
            <strong>exclusiva</strong> dele quanto à origem, à licitude da coleta e ao consentimento (opt-in)
            desses contatos — conforme detalhado nos Termos de Uso, item 4.
          </li>
          <li>Dados de uso da Plataforma (logs de acesso, campanhas enviadas, métricas de entrega).</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Como usamos os dados</h4>
        <p>
          Usamos os dados para: operar a Plataforma e suas funcionalidades; processar pagamentos; enviar
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
        <p>Adotamos medidas técnicas e organizacionais para proteger os dados tratados na Plataforma:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Senhas são armazenadas com hash bcrypt (irreversível) — nunca em texto puro, nem mesmo para nossa própria equipe.</li>
          <li>Credenciais de integração com o WhatsApp (tokens de acesso) são criptografadas com AES-256-GCM antes de serem gravadas no banco.</li>
          <li>A sessão de login é protegida por token assinado (HMAC-SHA256), com verificação de integridade a cada requisição.</li>
          <li>O acesso direto ao banco de dados é restrito a rotinas internas autenticadas; não há acesso público direto às tabelas do sistema.</li>
          <li>Os dados de cada empresa contratante (tenant) são isolados por controle de acesso próprio, impedindo que uma empresa visualize dados de outra.</li>
          <li>Permissões por perfil de usuário (administrador, corretor, atendente) limitam quais telas e ações cada pessoa da sua equipe pode executar.</li>
        </ul>
        <p>
          Nenhum sistema é 100% imune a incidentes. Mantemos essas medidas atualizadas conforme a evolução de
          boas práticas de segurança, mas a proteção efetiva também depende das ações do contratante — veja o
          item 8 (&quot;Responsabilidade em caso de incidente&quot;) e o item 3 dos Termos de Uso.
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
        <h4 className="font-bold text-slate-900">8. Responsabilidade em caso de incidente</h4>
        <p>
          Em caso de incidente de segurança envolvendo dados pessoais, a Domu Tech atuará para conter o
          problema, investigar a causa e comunicar o contratante em prazo razoável, conforme o art. 48 da
          LGPD, informando os dados afetados e as medidas adotadas.
        </p>
        <p>
          Quando o incidente for causado, total ou parcialmente, por ação ou omissão do contratante — como
          compartilhamento de senha, não adoção de recomendações de segurança, concessão de acesso a pessoas
          não autorizadas, ou inserção de dados de terceiros sem base legal adequada — a responsabilidade por
          eventuais danos a titulares de dados, multas da ANPD ou indenizações a terceiros é do contratante,
          nos termos do item 7 dos Termos de Uso. Nesses casos, cabe ao contratante, na qualidade de
          controlador dos dados afetados, avaliar e cumprir seu próprio dever de comunicação à ANPD e aos
          titulares.
        </p>
        <p>
          A Domu Tech responde pelos incidentes decorrentes de falha em suas próprias medidas de segurança
          (item 5), na medida da sua responsabilidade, conforme a legislação aplicável.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">9. Cookies e sessão</h4>
        <p>
          Usamos apenas um cookie técnico, essencial para manter sua sessão autenticada (HttpOnly, não
          acessível via JavaScript). Não utilizamos cookies de rastreamento, publicidade ou analytics de
          terceiros.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Alterações desta política</h4>
        <p>
          Podemos atualizar esta Política periodicamente. A data da versão vigente é exibida no rodapé deste
          documento. Alterações relevantes serão comunicadas na Plataforma.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">11. Contato</h4>
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
