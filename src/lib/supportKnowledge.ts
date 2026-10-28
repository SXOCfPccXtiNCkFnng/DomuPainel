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
• **Follow-up Automático** — mensagem automática para quem parou de responder.
• **Métricas de ROI** — alcance e respostas.
• **Templates de Mensagens** — modelos enviados à Meta.
• **Contatos e Segmentação** — base e importação.
• **Relatórios**, **Configurações** e **Assinatura e Planos**.

**Imóveis** e **Leads e Respostas** aparecem no segmento imobiliário marcados como **Em breve**. O segmento “Somente Disparos” não usa esses dois.`,
  },
  {
    id: 'status_envio',
    question: 'O que significa cada status de envio (Na fila, Enviando, Enviado, Entregue, Lido, Falhou)?',
    shortLabel: 'Status de envio da campanha',
    keywords: ['status', 'na fila', 'enviando', 'enviado', 'entregue', 'lido', 'falhou', 'progresso', 'acompanhar'],
    answer: `Status de cada contato numa campanha (tela de progresso em **Disparo de Campanha**):

• **Na fila:** aguardando a vez de sair.
• **Enviando:** a Domu já mandou para a Meta e aguarda a confirmação.
• **Enviado:** a Meta aceitou a mensagem.
• **Entregue:** chegou no celular do contato.
• **Lido:** o contato abriu (só aparece se ele não desativou a confirmação de leitura).
• **Falhou:** não saiu — o motivo aparece na própria lista de destinatários e no quadro **"Por que algumas mensagens falharam"**.

Na tela de progresso dá para filtrar a lista (Lidos, Entregues, Falhas, Na fila), buscar por nome ou telefone e clicar nos números do topo para filtrar.

Campanhas grandes saem em lotes: a barra avança aos poucos, e o envio continua mesmo com a tela fechada.`,
  },
  {
    id: 'enviado_nao_entregue',
    question: 'Minhas mensagens aparecem como enviadas, mas não são entregues. Por quê?',
    shortLabel: 'Enviado mas não entregue',
    keywords: ['nao entregue', 'não entregue', 'nao chegou', 'não chegou', 'nao recebeu', 'não recebeu', 'so enviado', 'só enviado', 'entrega'],
    answer: `Quando fica em **Enviado** e não passa para **Entregue**, as causas mais comuns são:

1. **Sem cartão na Meta:** para templates de **Marketing**, a Meta exige um meio de pagamento cadastrado no **WhatsApp Manager** da sua empresa. Sem isso ela aceita, mas não entrega.
2. O contato não tem WhatsApp naquele número, ou o celular está desligado/sem internet (a Meta tenta por até alguns dias).
3. O contato bloqueou seu número.

Comece conferindo o cartão em **WhatsApp Manager → Configurações de pagamento**.`,
  },
  {
    id: 'erros_meta',
    question: 'O que significam os erros da Meta numa campanha que falhou?',
    shortLabel: 'Campanha falhou: e agora?',
    keywords: ['erro', 'falha', 'falhou', 'deu erro', '131058', '132001', '131030', '131047', '131026', '130429', 'expirou', 'token'],
    answer: `Erros mais comuns (o motivo aparece na lista de destinatários da campanha — filtre por **Falhas**):

• **Template não encontrado ou não aprovado (132001):** o modelo não está aprovado nesse número. Confira em **Templates**.
• **Modelos de exemplo da Meta (131058):** "hello_world" e similares só funcionam no número de teste. Crie seu próprio template.
• **Número fora da lista de teste (131030):** a conta da Meta ainda está em modo de desenvolvimento.
• **Número inválido / sem WhatsApp (131026).**
• **Limite temporário da Meta (130429):** aguarde alguns minutos.
• **Credenciais expiradas:** reconecte o WhatsApp em **Configurações → Integração WhatsApp**.
• **Opt-out:** o contato pediu para não receber; a Domu pula automaticamente.`,
  },
  {
    id: 'agendar_campanha',
    question: 'Como agendar uma campanha para outro dia ou horário?',
    shortLabel: 'Agendar campanha',
    keywords: ['agendar', 'agendamento', 'agendada', 'horario', 'horário', 'programar', 'depois', 'mais tarde'],
    answer: `1. Em **Disparo de Campanha**, clique em **Nova Campanha**.
2. Escolha o template e os contatos normalmente.
3. Na etapa de envio, escolha **Agendar** e defina data e hora.

A campanha fica como **Agendada** e sai sozinha no horário, mesmo com o painel fechado. Se o horário já passou, aparece o botão **Disparar agora** na tela de progresso. Lembre: no plano Starter existe a trava de 200 disparos por dia.`,
  },
  {
    id: 'financeiro',
    question: 'Como vejo quanto faturei e o meu lucro?',
    shortLabel: 'Financeiro',
    keywords: ['financeiro', 'faturamento', 'faturei', 'lucro', 'gasto', 'gastos', 'despesa', 'despesas', 'receita', 'caixa'],
    answer: `Em **Financeiro** (lava rápido e saúde e beleza), escolha o mês:
• **Faturamento pela agenda:** soma o preço dos atendimentos feitos (concluídos, ou confirmados cujo horário já passou). Marque na Agenda quem **faltou** ou **cancelou** para o número ficar certo.
• **Lançar gasto:** produtos, aluguel, comissões, contas, marketing...
• **Lançar entrada:** vendas fora da agenda, como produtos.

O **lucro** é o faturamento + entradas − gastos. Também aparecem o ticket médio, o previsto até o fim do mês e quanto se perdeu com faltas. Só administradores veem o financeiro.`,
  },
  {
    id: 'saude_beleza_agenda',
    question: 'Como funciona a agenda e a atendente para barbearia, salão, estética ou clínica?',
    shortLabel: 'Agenda de saúde e beleza',
    keywords: ['barbearia', 'barbeiro', 'salao', 'salão', 'manicure', 'estetica', 'estética', 'clinica', 'clínica', 'dentista', 'consultorio', 'consultório', 'cabeleireira'],
    answer: `1. Em **Serviços e horários → Serviços**, cadastre cada serviço com nome, **duração** (o tempo que ocupa na agenda) e preço (opcional). Se precisar de avaliação antes, escreva isso na descrição.
2. Na aba **Horários e lembretes**, defina o horário de funcionamento e, se atende mais de um cliente ao mesmo tempo (cadeiras, salas ou profissionais), ligue essa opção e diga quantos.
3. Em **Atendente IA**, ajuste nome, tom e as regras do seu negócio (tolerância de atraso, cancelamento) e ligue.

A atendente apresenta os serviços, mostra só horários livres, confirma antes de marcar e o cliente recebe lembrete antes do horário. Ela **não dá orientação de saúde**: diagnóstico, indicação de tratamento ou resultado ficam com o profissional, e em caso de urgência ela orienta procurar atendimento e avisa a equipe.`,
  },
  {
    id: 'imobiliaria_atendente',
    question: 'Como funciona a atendente de IA para imobiliária?',
    shortLabel: 'Atendente IA da imobiliária',
    keywords: ['imobiliaria', 'imobiliária', 'corretor', 'imovel', 'imóvel', 'imoveis', 'imóveis', 'lead', 'visita', 'construtora'],
    answer: `1. Cadastre os imóveis em **Imóveis** (valor, bairro, quartos e o **link com fotos**). A atendente só fala do que está cadastrado e disponível.
2. Em **Atendente IA**, ajuste nome, tom e as informações da imobiliária (financiamento, documentos, horários) e ligue.

O que ela faz depende do plano:
• **Starter (primeiro atendimento):** entende o que o cliente procura (comprar ou alugar, tipo, região, valor, quartos), mostra os imóveis compatíveis e passa para o corretor quando ele se interessa ou quer visitar.
• **Pro e Enterprise (atendimento completo):** além disso, tira dúvidas sobre o imóvel e anota o **pedido de visita** com o dia e o horário que o cliente prefere. O pedido aparece em **Visitas** para você confirmar.

Em **Leads** fica o que cada cliente contou que procura e em que etapa está. Negociação, proposta e financiamento ela sempre passa para o corretor.

No Pro, ao confirmar uma visita (em **Visitas**, ou pelo botão **Agendar visita** em Leads), você informa a data e a hora e escolhe com quanto tempo antes o cliente recebe um **aviso pelo WhatsApp** (ex.: 1 hora, 1 dia ou o tempo que quiser).

A atendente também entende **áudios**: ela transcreve e responde ao que o cliente falou.

Cada plano tem um limite de **imóveis ativos** no catálogo (disponíveis e lançamentos): Starter 30, Pro 150 e Enterprise 500. Vendidos, alugados e reservados não contam.`,
  },
  {
    id: 'lembrete_agendamento',
    question: 'O cliente recebe lembrete do horário marcado na agenda?',
    shortLabel: 'Lembrete do agendamento',
    keywords: ['lembrete', 'lembrar', 'esquecer', 'esqueceu', 'faltou', 'falta', 'aviso', 'antes do horario', 'antes do horário'],
    answer: `Sim. Em **Serviços e horários → Horários e lembretes**, na parte **Lembretes para o cliente**:
• **Lembrar 1 hora antes** (ligado por padrão).
• **Lembrete em cima da hora:** 15 ou 30 minutos antes, ou desligado.

Se o cliente falou com você nas últimas 24h, o lembrete vai como mensagem normal. Se não, a Meta exige um modelo aprovado: a Domu cadastra esse modelo sozinha quando você salva a agenda, e a aprovação costuma levar poucos minutos.

Lembrete **não conta** no limite de disparos do plano. Na lista de agendamentos aparece se o lembrete foi enviado ou por que não saiu.`,
  },
  {
    id: 'limite_plano',
    question: 'Qual a diferença entre o limite do meu plano Domu e o limite da Meta?',
    shortLabel: 'Limite do plano x limite da Meta',
    keywords: ['limite do plano', 'limite mensal', 'limite diario', 'limite diário', 'excedido', 'estourou', 'disparos por mes', 'disparos por mês'],
    answer: `São dois limites independentes:

• **Limite do plano Domu** (por mês): **Starter** até 500 disparos/mês e 200/dia; **Pro** até 2.000/mês; **Enterprise** até 6.000/mês.
• **Limite da Meta** (por 24 horas, por número): 250, 1.000, 10.000… conversas iniciadas. Sobe sozinho com boa qualidade.

O disparo é bloqueado se qualquer um dos dois for passar. Para ampliar o da Domu, troque de plano em **Assinatura e Planos**.`,
  },
  {
    id: 'planos_assinatura',
    question: 'Como funcionam os planos, o pagamento e a troca ou cancelamento da assinatura?',
    shortLabel: 'Planos e assinatura',
    keywords: ['plano', 'planos', 'assinatura', 'pix', 'cartao de credito', 'cartão de crédito', 'mensalidade', 'trocar plano', 'mudar plano', 'upgrade', 'cancelar assinatura', 'renovar', 'vencimento'],
    answer: `Tudo fica em **Assinatura e Planos** (só Administradores):

• Planos **Starter**, **Pro** e **Enterprise** — o valor atualizado aparece na própria tela. Contas no modo **Somente Disparos** usam o Starter; assinar Pro ou Enterprise passa a conta para o modo completo.
• Pagamento mensal por **PIX** (5% de desconto, o QR Code é gerado na hora) ou **cartão de crédito**.
• **Trocar de plano:** escolha o novo plano e conclua o pagamento; ele vale quando o pagamento é confirmado.
• **Cancelar:** pelo botão de cancelamento na mesma tela; as cobranças futuras são encerradas.
• Com a assinatura vencida, o painel continua acessível, mas os disparos ficam bloqueados até regularizar.

A cobrança das conversas é da **Meta**, separada da mensalidade Domu.`,
  },
  {
    id: 'equipe',
    question: 'Como convidar pessoas da equipe e quais são as permissões de cada função?',
    shortLabel: 'Convidar equipe e permissões',
    keywords: ['equipe', 'convidar', 'convite', 'usuario', 'usuário', 'usuarios', 'colaborador', 'permissao', 'permissão', 'atendente', 'corretor', 'administrador', 'acesso'],
    answer: `Em **Configurações → Equipe e permissões** (só Administradores):

1. Informe nome, e-mail e a função.
2. A pessoa recebe um e-mail para criar a senha (o convite vale 7 dias).

Funções:
• **Administrador:** tudo, inclusive equipe, assinatura e conexão do WhatsApp.
• **Corretor:** cria templates e dispara campanhas.
• **Atendente:** consulta e atende, mas não dispara nem apaga contatos.

Limite de usuários: Starter 2, Pro 5, Enterprise 10. Removeu alguém? O acesso cai na hora.`,
  },
  {
    id: 'opt_out',
    question: 'Como funciona o opt-out (contato que pede para não receber mais)?',
    shortLabel: 'Contato pediu para sair',
    keywords: ['opt-out', 'optout', 'opt out', 'descadastrar', 'nao quero receber', 'não quero receber', 'sair da lista', 'parar de receber', 'remover numero', 'remover número'],
    answer: `Quando o contato responde algo como **"sair"**, **"parar"**, **"stop"**, **"cancelar"**, **"não quero receber"** ou **"remover meu número"**, a Domu marca o opt-out automaticamente.

• Ele deixa de receber campanhas (fica de fora até de envios já na fila).
• Continua na sua lista de **Contatos**, marcado como opt-out.
• Respeitar o opt-out é regra da Meta e protege a qualidade do seu número.

Dica: termine o template com algo como "Responda SAIR para não receber mais".`,
  },
  {
    id: 'senha',
    question: 'Esqueci minha senha ou quero trocar a senha. Como faço?',
    shortLabel: 'Trocar ou recuperar senha',
    keywords: ['senha', 'esqueci', 'recuperar', 'redefinir', 'trocar senha', 'alterar senha', 'login', 'nao consigo entrar', 'não consigo entrar'],
    answer: `• **Esqueceu:** na tela de login clique em **Esqueceu a senha?**, informe o e-mail e use o link que chega (vale 1 hora; confira o spam).
• **Quer trocar:** em **Configurações → Meu Perfil**, informe a senha atual e a nova.

Ao trocar a senha, os outros aparelhos conectados saem da conta por segurança.`,
  },
  {
    id: 'follow_up_como_funciona',
    question: 'Como funciona o Follow-up Automático?',
    shortLabel: 'Como funciona o follow-up',
    keywords: ['follow-up', 'follow up', 'followup', 'nao respondeu', 'não respondeu', 'parou de responder', 'mensagem automatica', 'mensagem automática', 'lembrete', 'cobrar resposta'],
    answer: `O **Follow-up Automático** manda uma mensagem sua para quem parou de responder. Fica no menu **Follow-up Automático** e tem dois tipos, ligados separadamente:

• **Conversa:** você respondeu um contato (pelo celular ou pela plataforma) e ele sumiu. Depois do tempo escolhido (1h a 24h), sai a sua mensagem — texto livre, sem aprovação da Meta. Ela sempre sai antes de a conversa do WhatsApp fechar (24h depois da última mensagem do contato).
• **Campanha (opcional):** para quem recebeu uma campanha e nunca respondeu. Como essa pessoa não abriu conversa, a Meta exige aprovar a mensagem — a Domu envia para aprovação sozinha quando você salva.

Use **+ Nome do contato** na mensagem para ela chegar com o primeiro nome da pessoa ({{nome}}).

É **um follow-up por mensagem sua**: se o contato não responder o follow-up, nada mais é enviado. Se ele responder, conta em **"Responderam"**.`,
  },
  {
    id: 'follow_up_protecoes',
    question: 'Por que um follow-up não foi enviado (Evitado)?',
    shortLabel: 'Follow-up evitado / não enviado',
    keywords: ['evitado', 'nao enviou', 'não enviou', 'nao foi enviado', 'não foi enviado', 'nao saiu', 'não saiu', 'follow up nao', 'follow up não', 'follow-up nao enviou', 'follow-up não enviou', 'nao mandou follow', 'não mandou follow', 'protecao', 'proteção', 'ia barrou', 'barrado'],
    answer: `O follow-up só sai quando faz sentido na conversa — na dúvida, ele **não** é enviado. O motivo de cada um aparece na lista **Últimos follow-ups**. Os mais comuns:

• **O contato respondeu antes** do prazo ("Nem precisou").
• **A IA percebeu que a conversa terminou:** despedida, negócio fechado ou pago, visita combinada, dúvida já resolvida, sem interesse, reclamação, assunto delicado, ou **você** ficou de responder/enviar algo.
• **"Te falo amanhã" / "vou pensar":** vira **lembrete**, mas só depois de algumas horas ou do prazo que o contato deu.
• **Limite por contato:** a pessoa já recebeu um follow-up nas últimas 24h (configurável em Proteções).
• **Status bloqueado** (ex.: Fechado), **contato pausado** ou **opt-out**.
• **A conversa do WhatsApp fechou** (passaram 24h desde a última mensagem do contato).

A IA lê só **texto**: áudio, foto e figurinha ela vê como "mídia", sem saber o conteúdo — se for a mensagem decisiva, ela prefere não enviar.`,
  },
  {
    id: 'follow_up_custo',
    question: 'O follow-up conta no limite do plano? A Meta cobra?',
    shortLabel: 'Follow-up: limite e custo',
    keywords: ['follow-up conta', 'follow up conta', 'follow up limite', 'follow up plano', 'follow up custo', 'follow up cobra', 'follow-up limite', 'follow-up custo', 'follow-up cobra', 'follow-up plano', 'follow-up gasta'],
    answer: `• **Não conta** no limite de disparos do seu plano Domu.
• **Conversa:** é uma mensagem dentro da conversa aberta do WhatsApp — pela tabela atual da Meta, não tem custo de template.
• **Campanha:** usa um template aprovado, que a Meta cobra como mensagem de marketing.
• Ele conta, sim, no **limite diário da Meta** do seu número (o mesmo das campanhas), para o número não ser bloqueado.`,
  },
  {
    id: 'contatos_automaticos',
    question: 'Os contatos que me mandam mensagem são salvos sozinhos?',
    shortLabel: 'Contatos salvos automaticamente',
    keywords: ['salvar contato', 'contato automatico', 'contato automático', 'gravar numero', 'gravar número', 'novo contato', 'contato whatsapp', 'sem nome', 'nome do contato'],
    answer: `Sim. Quando alguém manda mensagem para o seu número conectado, o contato é criado sozinho em **Contatos e Segmentação**, com o nome do perfil do WhatsApp — sem precisar importar. Cada conta só vê os próprios contatos.

Se aparecer **"Contato WhatsApp"**, a Meta não mandou o nome: acontece quando a pessoa não tem nome no perfil, quando a primeira mensagem foi sua (pelo celular) ou com mensagens que a API não suporta (enquete, visualização única). O nome entra sozinho na próxima mensagem de texto dela — ou edite em **Tags**.

O botão **WhatsApp** na lista de contatos abre a conversa com o número.`,
  },
  {
    id: 'desconectar_whatsapp',
    question: 'Como desconectar ou trocar o número do WhatsApp?',
    shortLabel: 'Desconectar / trocar número',
    keywords: ['desconectar', 'trocar numero', 'trocar número', 'reconectar', 'mudar numero', 'mudar número', 'numero dedicado', 'número dedicado'],
    answer: `Em **Configurações → Integração Meta**, use **Desconectar** (só administradores). Contatos, campanhas e histórico continuam salvos; até conectar de novo, nada é enviado nem recebido pela plataforma — o app do celular segue funcionando.

Depois aparecem as opções de conexão:
• **Continuar com seu WhatsApp atual (coexistência):** login da Meta + QR code; o app do celular continua funcionando.
• **Número dedicado:** um número novo, só na plataforma, confirmado por SMS ou ligação — o app do celular deixa de usar esse número.

Para reconectar, entre com um perfil do Facebook que tenha acesso à empresa dona do número na Meta.`,
  },
  {
    id: 'segmento',
    question: 'Qual a diferença entre o segmento Imobiliário e o Somente Disparos? Posso trocar?',
    shortLabel: 'Segmento da conta',
    keywords: ['segmento', 'somente disparos', 'imobiliario', 'imobiliário', 'trocar segmento', 'mudar segmento', 'modo', 'completo'],
    answer: `• **Somente Disparos:** painel enxuto (campanhas, templates, contatos e métricas de envio). É exclusivo do plano **Starter**.
• **Modo completo:** os mesmos disparos e, em breve, atendimento das respostas (**Leads e Respostas**) — vem nos planos **Pro** e **Enterprise**.

Para sair do Somente Disparos não precisa trocar nada à mão: em **Assinatura e Planos**, assine o **Pro** ou o **Enterprise** e confirme o ramo do seu negócio (barbearia, pizzaria, imobiliária...). Quando o pagamento confirmar, a conta ativa as ferramentas desse ramo sozinha. Contatos, campanhas, templates e a conexão do WhatsApp continuam iguais.`,
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
