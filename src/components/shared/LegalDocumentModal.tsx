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
          Plataforma, você declara ter lido, compreendido e aceito integralmente estes termos, e que tem poderes
          para aceitá-los em nome da empresa que está cadastrando.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">2. Descrição do serviço</h4>
        <p>
          A Plataforma oferece ferramentas de disparo de mensagens, automação de atendimento, gestão de contatos
          (leads) e relatórios, integradas à WhatsApp Business Platform (Meta Cloud API). A Plataforma depende de
          serviços de terceiros — Meta (WhatsApp), Asaas (pagamentos) e provedores de e-mail — cuja
          disponibilidade não está sob nosso controle. Podemos alterar, melhorar ou descontinuar funcionalidades
          da Plataforma a qualquer momento, buscando sempre comunicar mudanças relevantes com antecedência
          razoável.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Cadastro, conta e segurança de acesso</h4>
        <p>
          Você é responsável pela veracidade dos dados cadastrados, pela guarda de sua senha e por toda
          atividade realizada com sua conta. Contas são de uso da empresa contratante; usuários adicionais
          (corretores, atendentes) podem ser convidados pelo administrador da conta, que responde pelo uso
          feito por sua equipe, inclusive após o desligamento de algum colaborador — é responsabilidade do
          administrador remover o acesso de quem deixar a empresa.
        </p>
        <p>
          O login e a senha de acesso são pessoais e intransferíveis. Você se compromete a manter o sigilo de
          suas credenciais e a não compartilhá-las com ninguém, incluindo colegas de trabalho que devam ter
          acesso próprio (nesse caso, use o convite de equipe da Plataforma, que cria um acesso individual em
          vez de dividir o seu). Depois que uma credencial é compartilhada, perdida ou usada por outra pessoa
          com o seu conhecimento, não é possível alegar uso indevido da conta — toda atividade realizada com
          um login e senha válidos é considerada feita pelo contratante ou por sua autorização.
        </p>
        <p>
          Sempre que a Plataforma sugerir alguma recomendação de segurança — como usar uma senha forte e
          exclusiva, ativar alguma camada extra de confirmação quando disponível, revisar periodicamente quem
          tem acesso à conta, ou remover pessoas que já não fazem parte da equipe — é responsabilidade do
          contratante seguir essas recomendações. Se um problema de segurança acontecer justamente porque uma
          dessas recomendações não foi seguida, a Domu Tech não responde por esse problema.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">4. Uso aceitável, anti-spam e responsabilidade sobre dados de terceiros</h4>
        <p>
          É obrigatório ter o consentimento prévio da pessoa (opt-in) ou outra justificativa legal válida antes
          de enviar mensagens comerciais a qualquer contato. É proibido usar a Plataforma para spam, phishing,
          conteúdo ilegal, discurso de ódio, listas de contatos comprada de origem duvidosa, ou qualquer prática
          que viole as políticas da WhatsApp Business Platform. O descumprimento pode levar ao bloqueio do
          número pela própria Meta — o que está fora do nosso controle — e à suspensão da conta na Plataforma,
          sem reembolso de valores já pagos no período.
        </p>
        <p>
          Todo contato, lead ou dado pessoal de terceiro que você insere, importa ou cadastra na Plataforma é
          de sua responsabilidade exclusiva — inclusive quanto a de onde esse dado veio, se a pessoa consentiu
          em ser contatada, e se essa coleta respeita a lei de proteção de dados. A Domu Tech apenas processa
          esses dados seguindo as instruções que você dá através do uso da Plataforma, sem verificar a origem
          ou a forma como você os coletou. Se algum contato, órgão fiscalizador ou terceiro reclamar, processar
          ou multar a Domu Tech por causa de um dado que você inseriu sem ter esse direito, você se compromete
          a assumir e reembolsar todo prejuízo, multa ou despesa (incluindo advogados) que isso gerar pra nós.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">5. Conteúdo das mensagens e conformidade</h4>
        <p>
          O conteúdo das mensagens, campanhas, imagens e informações sobre imóveis ou serviços divulgados
          através da Plataforma é de sua exclusiva responsabilidade — incluindo a veracidade das informações
          anunciadas, o cumprimento do Código de Defesa do Consumidor, e qualquer regra específica de
          publicidade do seu setor de atuação. A Domu Tech não revisa, aprova nem se responsabiliza pelo
          conteúdo do que você envia através da Plataforma, apenas fornece a ferramenta de envio.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">6. Planos, cobrança e cancelamento</h4>
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
        <h4 className="font-bold text-slate-900">7. Propriedade intelectual</h4>
        <p>
          O software, marca, layout e demais elementos da Plataforma são de propriedade da Domu Tech. O uso da
          Plataforma não transfere qualquer direito de propriedade intelectual ao contratante. Os dados inseridos
          pelo contratante (leads, templates, mensagens) permanecem de sua titularidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">8. Confidencialidade</h4>
        <p>
          Ambas as partes se comprometem a manter em sigilo informações confidenciais da outra parte às quais
          venham a ter acesso por causa deste contrato (ex.: dados comerciais, estratégias, informações
          técnicas não públicas), utilizando-as apenas para os fins deste contrato, mesmo após o seu término.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">9. Exportação e cópia de segurança dos seus dados</h4>
        <p>
          Você é responsável por manter suas próprias cópias e exportações dos dados que considerar
          importantes (contatos, relatórios, histórico de campanhas) enquanto sua conta estiver ativa. A Domu
          Tech não tem obrigação de guardar seus dados indefinidamente após o encerramento da conta, respeitados
          os prazos mínimos de guarda descritos na Política de Privacidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Limitação de responsabilidade</h4>
        <p>
          A Plataforma é fornecida &quot;como está&quot;. Não garantimos disponibilidade ininterrupta, nem nos
          responsabilizamos por indisponibilidade, bloqueio ou alteração de política por parte da Meta, Asaas
          ou outros provedores terceiros. Nossa responsabilidade, quando aplicável, está limitada ao valor
          pago pelo contratante nos 3 (três) meses anteriores ao evento, exceto nos casos em que a lei
          brasileira não admita esse tipo de limitação (por exemplo, se o problema tiver sido causado de forma
          intencional ou por erro grave da própria Domu Tech).
        </p>
        <p>
          A Domu Tech <strong>não se responsabiliza</strong> por incidentes de segurança, vazamento ou perda de
          dados que decorram, total ou parcialmente, de:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Senha fraca, reutilizada em outros serviços, ou compartilhamento de credenciais pelo contratante ou por sua equipe;</li>
          <li>Não seguir alguma recomendação de segurança que a Domu Tech tenha comunicado (item 3);</li>
          <li>Acesso concedido a pessoas não autorizadas, ou acesso de ex-colaboradores que não foi removido a tempo pelo administrador da conta;</li>
          <li>Aparelhos, redes ou programas de terceiros usados pelo contratante para acessar a Plataforma que estejam infectados por vírus, praga digital, ou comprometidos por golpe direcionado ao próprio usuário;</li>
          <li>Dados de terceiros inseridos na Plataforma sem o devido direito de coletá-los, conforme item 4;</li>
          <li>Ações de terceiros fora do nosso controle, incluindo falhas de segurança da própria Meta, do Asaas ou de outros provedores usados na integração.</li>
        </ul>
        <p>
          Nesses casos, quem responde pelo incidente e por eventuais danos a pessoas afetadas ou a terceiros é
          exclusivamente o contratante, que se compromete a ressarcir a Domu Tech por qualquer prejuízo, multa
          ou despesa (incluindo honorários de advogado) que isso gerar.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">11. Suspensão e rescisão</h4>
        <p>
          Podemos suspender ou encerrar contas em caso de inadimplência, uso indevido ou violação destes
          termos, mediante aviso prévio quando possível. Dados poderão ser mantidos pelo período necessário
          para cumprimento de obrigações legais/fiscais e depois excluídos, conforme nossa Política de
          Privacidade.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">12. Incidentes de segurança</h4>
        <p>
          Se acontecer um incidente de segurança que possa gerar risco ou dano relevante às pessoas cujos
          dados estão na Plataforma, a Domu Tech vai avisar o contratante em prazo razoável, contando o que
          aconteceu, quais dados foram afetados e o que está sendo feito para resolver e reduzir o risco.
          Quando o incidente tiver sido causado por uma das situações listadas no item 10 (culpa do
          contratante), é o próprio contratante — não a Domu Tech — quem deve avaliar e, se necessário, avisar
          formalmente a Autoridade Nacional de Proteção de Dados (ANPD) e as pessoas afetadas.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">13. Força maior</h4>
        <p>
          Nenhuma das partes será responsável por atraso ou falha no cumprimento destes Termos causado por
          evento fora de seu controle razoável — como falhas generalizadas de internet, desastres naturais,
          decisões governamentais, greves, ataques em larga escala à infraestrutura de terceiros, ou
          indisponibilidade dos serviços da Meta, do Asaas ou de outros provedores essenciais à Plataforma.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">14. Cessão do contrato</h4>
        <p>
          O contratante não pode transferir os direitos e obrigações destes Termos a terceiros sem autorização
          prévia por escrito da Domu Tech. A Domu Tech pode transferir este contrato em caso de reorganização
          societária, fusão ou venda do negócio, mantendo as condições já acordadas.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">15. Alterações destes termos</h4>
        <p>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas na Plataforma antes
          de exigirem novo aceite. O uso continuado após a atualização implica concordância com a nova versão.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">16. Lei aplicável e foro</h4>
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
          Tech atua apenas como <strong>operadora</strong> — trata esses dados seguindo as instruções do
          contratante, que é quem responde pela origem, licitude e base legal desses dados (ver item 4 dos
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
          <li>Dados de conta: nome, e-mail, telefone e senha.</li>
          <li>Dados da empresa: razão comercial, segmento de atuação, número de WhatsApp.</li>
          <li>Dados de cobrança: CPF/CNPJ e histórico de pagamento, processados pelo Asaas.</li>
          <li>
            Dados de contatos (leads) importados ou cadastrados pelo contratante, sob responsabilidade{' '}
            <strong>exclusiva</strong> dele quanto à origem, à licitude da coleta e ao consentimento (opt-in)
            desses contatos — conforme detalhado nos Termos de Uso, item 4.
          </li>
          <li>Dados de uso da Plataforma (registros de acesso, campanhas enviadas, métricas de entrega).</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">3. Como usamos os dados</h4>
        <p>
          Usamos os dados para: operar a Plataforma e suas funcionalidades; processar pagamentos; enviar
          comunicações operacionais (confirmação de conta, redefinição de senha, avisos de cobrança); cumprir
          obrigações legais e fiscais; e melhorar a segurança e a qualidade do serviço. Não usamos os dados
          para publicidade de terceiros, nem vendemos dados de clientes ou de leads.
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
        <p>
          Além dos casos acima, só compartilhamos dados com terceiros se você autorizar expressamente, se
          formos obrigados por lei, ordem judicial ou autoridade competente, ou em caso de reorganização
          societária, fusão ou venda do negócio (mantendo o mesmo nível de proteção).
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">5. Transferência internacional de dados</h4>
        <p>
          Alguns dos provedores que usamos (como Meta e serviços de e-mail) podem processar dados em
          servidores localizados fora do Brasil. Nesses casos, exigimos que esses provedores adotem padrões de
          proteção compatíveis com a LGPD, seja por meio de cláusulas contratuais específicas, selos de
          conformidade internacionalmente reconhecidos, ou por estarem sediados em país com nível de proteção
          de dados considerado adequado.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">6. Como protegemos os dados</h4>
        <p>Adotamos medidas para proteger os dados tratados na Plataforma, entre elas:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sua senha é guardada de um jeito que nem a nossa própria equipe consegue ler ou recuperar o valor original — só você sabe qual é.</li>
          <li>As credenciais de conexão com o WhatsApp de cada cliente são embaralhadas antes de serem guardadas, de forma que fiquem ilegíveis mesmo em caso de acesso indevido ao banco de dados.</li>
          <li>Cada login gera uma chave de acesso própria, verificada a cada ação feita na Plataforma, o que impede que alguém finja ser você sem ter essa chave.</li>
          <li>O acesso direto ao banco de dados é restrito a rotinas internas da própria Plataforma; não existe uma porta de acesso público direto aos dados.</li>
          <li>Os dados de cada empresa contratante são isolados dos dados das demais empresas, impedindo que uma cliente veja informação de outra.</li>
          <li>Diferentes perfis de usuário (administrador, corretor, atendente) têm acessos diferentes, limitando quem na sua equipe pode ver ou fazer o quê.</li>
        </ul>
        <p>
          Nenhum sistema é 100% imune a incidentes. Mantemos essas medidas em revisão constante, mas a
          proteção efetiva também depende das ações do contratante — veja o item 9 (&quot;Responsabilidade em
          caso de incidente&quot;) e o item 3 dos Termos de Uso.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">7. Retenção, exclusão e cópia de segurança</h4>
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para cumprir obrigações
          legais/fiscais após o encerramento (ex.: registros de cobrança). Você pode solicitar a exclusão dos
          dados da sua conta a qualquer momento pelo canal de contato abaixo, respeitadas as retenções
          legalmente obrigatórias. Como descrito nos Termos de Uso (item 9), é responsabilidade do contratante
          manter suas próprias cópias dos dados que considerar importantes antes de encerrar a conta.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">8. Seus direitos (LGPD)</h4>
        <p>
          Você pode solicitar, a qualquer momento: confirmação de que tratamos seus dados, acesso a eles,
          correção de informação incorreta, anonimização, portabilidade para outro serviço, eliminação dos
          dados e revogação de um consentimento já dado. Respondemos a essas solicitações em até 15 dias.
          Para exercer esses direitos, entre em contato pelo e-mail{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-domu-blue hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">9. Responsabilidade em caso de incidente</h4>
        <p>
          Se acontecer um incidente de segurança envolvendo dados pessoais, a Domu Tech age para conter o
          problema, investigar a causa e avisar o contratante em prazo razoável, contando quais dados foram
          afetados e o que estamos fazendo pra resolver.
        </p>
        <p>
          Quando o incidente tiver sido causado, total ou parcialmente, por uma ação ou falta do contratante —
          como compartilhar senha, não seguir uma recomendação de segurança, deixar acesso aberto pra quem não
          devia ter, ou colocar na Plataforma dados de terceiros sem ter o direito de fazer isso — quem
          responde pelo problema é o contratante, conforme o item 10 dos Termos de Uso. Nesse caso, é o
          contratante quem deve avaliar e, se necessário, avisar formalmente a Autoridade Nacional de Proteção
          de Dados (ANPD) e as pessoas afetadas, já que ele é o responsável por esses dados de terceiros.
        </p>
        <p>
          A Domu Tech responde pelos incidentes que forem causados por falha em suas próprias medidas de
          proteção (item 6), na medida da sua responsabilidade, conforme a legislação aplicável.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">10. Cookies e sessão</h4>
        <p>
          Usamos apenas um cookie técnico, essencial para manter você conectado enquanto usa a Plataforma, que
          não pode ser lido por scripts no navegador. Não utilizamos cookies de rastreamento, publicidade ou
          análise de comportamento de terceiros.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">11. Alterações desta política</h4>
        <p>
          Podemos atualizar esta Política periodicamente. A data da versão vigente é exibida no rodapé deste
          documento. Alterações relevantes serão comunicadas na Plataforma.
        </p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">12. Contato</h4>
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
