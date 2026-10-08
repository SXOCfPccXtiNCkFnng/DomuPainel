export interface FAQItem {
  id: string;
  question: string;
  shortLabel: string;
  keywords: string[];
  answer: string;
}

/** Base usada pelos atalhos do chat e como contexto da IA. */
export const FAQ_KNOWLEDGE_BASE: FAQItem[] = [
  {
    id: 'como_disparar',
    question: 'Como criar uma campanha e fazer um disparo de mensagens?',
    shortLabel: 'Como fazer um disparo',
    keywords: [
      'disparo',
      'disparar',
      'disparos',
      'enviar',
      'envio',
      'campanha',
      'campanhas',
      'fazer disparo',
      'mandar mensagem',
      'disparo em massa',
      'criar campanha',
      'nova campanha',
    ],
    answer: `Para criar uma campanha e realizar um disparo de mensagens:

1. Acesse o menu **Disparo de Campanha** na barra lateral.
2. Clique no botão **"Nova Campanha"**.
3. **Escolha o Template:** Selecione um modelo já aprovado pela Meta.
4. **Selecione os Contatos:** Escolha a lista importada ou os contatos da campanha.
5. A plataforma respeita o limite diário do número na Meta para reduzir risco de bloqueio.
6. Inicie o disparo. O envio sai pela **API oficial** da Meta, não por WhatsApp Web.`,
  },
  {
    id: 'limite_diario',
    question: 'Como aumentar o limite diário da Meta (de 250 para 1.000 ou 10.000)?',
    shortLabel: 'Subir limite diário (250 para 1.000)',
    keywords: ['limite', '250', '1000', '1.000', '10000', '10.000', 'subir', 'aumentar', 'tier', 'cota', 'ampliar'],
    answer: `O limite diário é da **Meta**, não um plano extra da Domu. Os patamares comuns são 250, 1.000, 10.000 e 100.000 conversas iniciadas por dia.

A Meta sobe o patamar quando o número mantém **qualidade alta** e usa uma parte relevante do limite atual com boa aceitação (poucas denúncias e bloqueios). Não há chamado pago na Domu para “liberar” esse aumento.

Personalize com **{{nome}}**, use só contatos que optaram por receber e respeite o limite que o painel mostrar.`,
  },
  {
    id: 'cobranca_meta',
    question: 'Como funciona a cobrança oficial por conversa da Meta?',
    shortLabel: 'Como funciona a cobrança da Meta',
    keywords: ['cobranca', 'cobrança', 'custo', 'valor', 'preco', 'preço', 'pagamento', 'cartao', 'cartão', 'conversas', 'taxa'],
    answer: `A Domu **não cobra por mensagem**. A Meta cobra na **Business Manager do cliente**, conforme a tabela oficial do país e da categoria (Marketing, Utilidade, Autenticação, Serviço).

• Fora da janela de 24 horas, a empresa só inicia conversa com **template aprovado**, e essa conversa entra na cobrança da Meta.
• Quando o cliente **responde**, abre a janela de atendimento. Mensagens de resposta dentro dessa janela seguem as regras de serviço da Meta (em geral sem uma nova cobrança de marketing a cada balão).
• O valor exato muda. Consulte o **WhatsApp Manager / faturamento** da conta. Para disparo de marketing, a Meta costuma exigir um meio de pagamento na conta do WhatsApp.`,
  },
  {
    id: 'quality_rating',
    question: 'O que significa a nota Verde, Amarela e Vermelha (Quality Rating)?',
    shortLabel: 'Qualidade Verde, Amarela e Vermelha',
    keywords: ['qualidade', 'quality', 'rating', 'score', 'nota', 'verde', 'amarelo', 'vermelho', 'reputacao', 'reputação'],
    answer: `O **Quality Rating** é a nota da Meta para o número, com base no comportamento recente dos destinatários:

• **Verde:** qualidade alta. Leituras e respostas saudáveis, pouca denúncia.
• **Amarelo:** qualidade média. Vale pausar lista fria e revisar o texto.
• **Vermelho:** qualidade baixa. Risco de a Meta reduzir o limite ou restringir o número.

Isso é diferente de banimento por software não oficial. Na API oficial o risco principal é **qualidade e spam**, não “usar a Domu”.`,
  },
  {
    id: 'por_que_templates',
    question: 'Por que preciso criar e aprovar templates para disparar mensagens?',
    shortLabel: 'Por que templates são obrigatórios',
    keywords: [
      'por que template',
      'por que templates',
      'obrigatorio template',
      'preciso de template',
      'exigencia meta',
      'politica da meta',
    ],
    answer: `Template aprovado é exigência da Meta para a empresa **iniciar** conversa pela API oficial.

1. A Meta revisa o texto antes do envio em massa.
2. O primeiro contato (ou qualquer mensagem fora da janela de 24 horas) precisa ser um modelo aprovado.
3. Depois que a pessoa responde, dá para conversar livremente dentro da janela, sem novo template a cada mensagem.
4. Categoria errada (promoção marcada como Utilidade) é motivo comum de reprovação.`,
  },
  {
    id: 'criar_template',
    question: 'Como cadastrar e aprovar um novo modelo de mensagem (Template)?',
    shortLabel: 'Como aprovar novo template',
    keywords: [
      'como cadastrar template',
      'como criar template',
      'como aprovar template',
      'cadastrar template',
      'novo template',
      'criar novo modelo',
    ],
    answer: `Para cadastrar um template:

1. Abra **Templates de Mensagens**.
2. Crie um novo modelo.
3. Escolha **Marketing** para oferta/novidade ou **Utilidade** para aviso operacional (confirmação, lembrete).
4. Escreva o texto. Na Domu use **{{nome}}** — a plataforma converte para o formato da Meta ({{1}}, {{2}}).
5. Envie para aprovação. A análise automática da Meta costuma levar minutos, mas pode ir para revisão manual.`,
  },
  {
    id: 'template_rejeitado',
    question: 'O que fazer se o meu template for rejeitado pela Meta?',
    shortLabel: 'Template rejeitado pela Meta',
    keywords: ['template rejeitado', 'template recusado', 'template reprovado', 'reprovado pela meta', 'rejeitado pela meta'],
    answer: `Motivos frequentes de rejeição:

1. Variáveis coladas, sem texto no meio (ex.: \`{{1}} {{2}}\`).
2. Promoção cadastrada como **Utilidade**. Oferta é **Marketing**.
3. Link encurtado genérico (bit.ly e similares). Use o domínio da empresa.
4. Texto com erro grave, excesso de pontuação ou promessa enganosa.

Ajuste em **Templates** e envie de novo.`,
  },
  {
    id: 'conectar_meta',
    question: 'Como conectar a conta da Meta / WhatsApp Oficial?',
    shortLabel: 'Como conectar conta da Meta',
    keywords: ['conectar', 'conexao', 'conexão', 'vincular', 'waba', 'configurar whatsapp', 'conectar meta', 'embedded'],
    answer: `A conexão oficial fica em **Configurações** (ou no passo de WhatsApp do cadastro inicial).

1. Clique em **Conectar com Meta**.
2. Entre com o Facebook do **negócio**.
3. No popup da Meta, use o número que está no **WhatsApp Business** (app verde), não o WhatsApp pessoal.
4. Confirme no celular: mensagem da Meta, **Conectar à plataforma** e o código ou QR **dentro do app Business**.
5. Não desinstale o WhatsApp Business no meio do fluxo.

Coexistência mantém o app no celular e a API na Domu. Número dedicado da Cloud API é outro caminho: o chip fica só na API.`,
  },
  {
    id: 'variavel_nome',
    question: 'Por que é importante colocar {{nome}} nos templates?',
    shortLabel: 'Por que usar {{nome}} no template',
    keywords: ['variavel', 'variável', 'personalizar', 'personalizacao', 'personalização'],
    answer: `**{{nome}}** personaliza cada envio com o nome do contato importado.

A Domu troca {{nome}} pelo nome da planilha e envia à Meta no formato posicional ({{1}}). Mensagem personalizada tende a ter mais resposta e menos denúncia do que um texto idêntico para toda a lista.

Não cole duas variáveis seguidas sem palavras entre elas.`,
  },
  {
    id: 'importar_planilha',
    question: 'Como importar contatos de planilha Excel ou CSV?',
    shortLabel: 'Como importar contatos do Excel',
    keywords: ['planilha', 'excel', 'csv', 'importar', 'base', 'leads', 'lista', 'arquivo'],
    answer: `Em **Contatos e Segmentação**:

1. Use **Importar contatos** (planilha .xlsx ou .csv).
2. Colunas úteis: **Nome**, **Telefone / WhatsApp**, e-mail e tags.
3. O telefone precisa ter DDD. A plataforma normaliza o número para a Meta conseguir entregar.

Use só contatos que autorizaram receber mensagens da empresa.`,
  },
  {
    id: 'coexistencia',
    question: 'O que é o modo Coexistência e como funciona no meu celular?',
    shortLabel: 'Modo Coexistência no celular',
    keywords: ['celular', 'coexistencia', 'coexistência', 'aparelho', 'sincronizar', '14 dias', 'whatsapp business'],
    answer: `**Coexistência** é o recurso oficial da Meta: o mesmo número fica no **WhatsApp Business do celular** e na Cloud API (Domu).

• No celular continuam conversas 1 a 1, áudio e mídia.
• Na Domu saem os disparos de campanha com template.
• Abra o WhatsApp Business no aparelho pelo menos uma vez a cada cerca de **14 dias** para a sincronização não cair.
• Grupos, listas de transmissão e alguns recursos do app não vão para a API.
• API de Mensagens de Marketing (Marketing Messages) **não** combina com coexistência.

O QR desse fluxo aparece no celular, depois que a Meta manda o convite — não é o QR do WhatsApp Web.`,
  },
  {
    id: 'evitar_bloqueios',
    question: 'Quais são as melhores práticas para evitar bloqueios no WhatsApp?',
    shortLabel: 'Como evitar bloqueios de chip',
    keywords: ['evitar bloqueio', 'banir', 'banimento', 'denuncia', 'denúncia', 'spam', 'opt-out', 'opt out'],
    answer: `Na API oficial a Meta não bloqueia por “usar um sistema”. Ela reduz ou suspende o número por **qualidade**:

1. Só lista própria, com opt-in. Não compre base fria.
2. Personalize com {{nome}} e um texto que a pessoa reconheça.
3. Respeite o limite diário do número.
4. Dispare em horário comercial.
5. Ofereça saída (opt-out). Quem pedir para parar não deve receber nova campanha.
6. Template na categoria certa.`,
  },
  {
    id: 'janela_24h',
    question: 'Como funciona a janela de atendimento de 24 horas?',
    shortLabel: 'Janela de atendimento de 24 horas',
    keywords: ['janela', '24 horas', '24h', 'sessao', 'sessão', 'resposta'],
    answer: `A janela de 24 horas começa quando o **cliente** manda mensagem para o número já conectado na API.

Dentro dela a empresa responde sem precisar de um template novo a cada mensagem. Fora dela, o próximo contato iniciado pela empresa volta a exigir **template aprovado**.

Mensagem enviada só pelo app, antes de conectar a API, não abre essa janela da Cloud API.`,
  },
  {
    id: 'menus',
    question: 'Quais menus existem na plataforma?',
    shortLabel: 'Menus da plataforma',
    keywords: ['menu', 'menus', 'onde fica', 'imoveis', 'imóveis', 'assinatura', 'relatorio', 'relatório', 'dashboard'],
    answer: `Menus disponíveis:

• **Dashboard** — visão de disparos e respostas.
• **Disparo de Campanha** — criar e acompanhar envios.
• **Métricas de ROI** — alcance e respostas.
• **Templates de Mensagens** — modelos enviados à Meta.
• **Contatos e Segmentação** — base e importação.
• **Relatórios**, **Configurações** e **Assinatura e Planos**.

**Imóveis** e **Leads e Respostas** aparecem no segmento imobiliário marcados como **Em breve**. O segmento “Somente Disparos” não usa esses dois.`,
  },
];

const HUMAN_PHRASES = [
  'atendente',
  'falar com humano',
  'falar com alguem',
  'falar com alguém',
  'falar com suporte',
  'falar com uma pessoa',
  'quero um humano',
  'chamar suporte',
  'ajuda humana',
  'suporte humano',
  'falar no whatsapp do suporte',
];

export function wantsHumanSupport(query: string): boolean {
  const clean = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return HUMAN_PHRASES.some((phrase) =>
    clean.includes(phrase.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

const STOP_WORDS = new Set([
  'como', 'fazer', 'faco', 'faço', 'quero', 'saber', 'para', 'onde', 'qual', 'quais', 'quem',
  'com', 'por', 'que', 'uma', 'uns', 'umas', 'meu', 'minha', 'meus', 'minhas',
  'isso', 'esse', 'essa', 'aqui', 'sobre', 'tenho', 'tem', 'ter', 'pode', 'posso',
  'voce', 'você', 'meu', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'ou',
  'ja', 'já', 'so', 'só', 'ola', 'olá', 'bom', 'dia', 'tarde', 'noite', 'ajuda', 'ajudar',
]);

export function findBestAnswer(query: string): FAQItem | null {
  const clean = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let bestMatch: FAQItem | null = null;
  let maxScore = 0;

  const searchWords = clean
    .split(/[\s,?.!;:]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  for (const item of FAQ_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      const cleanKw = kw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (clean.includes(cleanKw)) score += cleanKw.length > 5 ? 10 : 6;
      for (const word of searchWords) {
        if (cleanKw === word) score += 5;
        else if (cleanKw.includes(word) && word.length >= 4) score += 2;
      }
    }
    const cleanQuestionWords = item.question
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[\s,?.!;:]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    for (const word of searchWords) {
      if (cleanQuestionWords.includes(word)) score += 3;
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  return maxScore >= 4 ? bestMatch : null;
}

export function formatSupportKnowledge(): string {
  return FAQ_KNOWLEDGE_BASE.map(
    (item) => `Pergunta: ${item.question}\nResposta:\n${item.answer}`
  ).join('\n\n---\n\n');
}
