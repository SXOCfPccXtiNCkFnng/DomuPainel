'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Headset,
  ExternalLink,
  RotateCcw,
  TrendingUp,
  CreditCard,
  Activity,
  Tag,
  FileSpreadsheet,
  Smartphone,
  ShieldAlert,
  Clock,
  HelpCircle,
  Link2,
  FileText,
} from 'lucide-react';
import { CONTACT_WHATSAPP_URL } from '@/lib/contact';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: string[];
  showWhatsAppLink?: boolean;
  whatsAppCustomText?: string;
}

interface FAQItem {
  id: string;
  question: string;
  shortLabel: string;
  keywords: string[];
  answer: string;
}

const FAQ_KNOWLEDGE_BASE: FAQItem[] = [
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
      'faco disparo',
      'mandar mensagem',
      'disparo em massa',
      'criar campanha',
      'nova campanha',
    ],
    answer: `Para criar uma campanha e realizar um disparo de mensagens:

1. Acesse o menu **Disparos** na barra lateral.
2. Clique no botão azul **"Nova Campanha"**.
3. **Escolha o Template:** Selecione o modelo de mensagem aprovado pela Meta.
4. **Selecione os Contatos:** Escolha a lista de leads importada ou adicione novos contatos.
5. **Segurança de Limite:** A plataforma calcula automaticamente seu limite diário da Meta (ex: 250, 1.000) para você não ter risco de bloqueio.
6. Clique em **"Iniciar Disparo"** para que o envio seja realizado automaticamente pela API Oficial!`,
  },
  {
    id: 'limite_diario',
    question: 'Como aumentar o limite diário da Meta (de 250 para 1.000 ou 10.000)?',
    shortLabel: 'Subir limite diário (250 para 1.000)',
    keywords: ['limite', '250', '1000', '1.000', '10000', '10.000', 'subir', 'aumentar', 'tier', 'cota', 'ampliar', 'escala'],
    answer: `O aumento do limite diário de mensagens da Meta é **100% automático e gratuito**! Você não precisa abrir chamado nem pagar nada extra.

**As 3 regras oficiais da Meta para o aumento:**
1. **Qualidade Verde:** Mantenha a pontuação do chip alta (personalize mensagens com o nome do cliente e evite contatos frios).
2. **Utilizar a cota atual:** Dispare pelo menos **50% do limite atual** em até 7 dias (exemplo: disparar mais de 125 mensagens quando estiver no limite de 250).
3. **Liberação em 48h:** Cumprindo os envios com boa aceitação dos clientes, o algoritmo da Meta eleva o patamar automaticamente (250 para 1.000, 10.000 e 100.000/dia).`,
  },
  {
    id: 'cobranca_meta',
    question: 'Como funciona a cobrança oficial por conversa da Meta?',
    shortLabel: 'Como funciona a cobrança da Meta',
    keywords: ['cobranca', 'cobrança', 'custo', 'valor', 'preco', 'preço', 'pagamento', 'cartao', 'cartão', 'conversas', 'taxa', 'meta cobrar'],
    answer: `A cobrança da Meta funciona da seguinte forma:

• **Cobrança por Sessão de 24h:** A Meta não cobra por cada balão de mensagem, e sim por **sessão de conversa aberta de 24 horas**.
• **Valor por Conversa de Marketing:** No Brasil, o envio de campanha custa em média **~US$ 0,06 (aprox. R$ 0,30 a R$ 0,35)** por lead atingido.
• **Janela de Atendimento Gratuita:** Quando o lead responde à sua mensagem, abre-se uma janela de 24 horas onde você pode trocar **quantas mensagens quiser sem cobranças adicionais** da Meta!
• **Cartão Obrigatório:** Para campanhas de Marketing, a Meta exige um cartão de crédito internacional cadastrado no seu WhatsApp Manager.`,
  },
  {
    id: 'quality_rating',
    question: 'O que significa a nota Verde, Amarela e Vermelha (Quality Rating)?',
    shortLabel: 'Qualidade Verde, Amarela e Vermelha',
    keywords: ['qualidade', 'quality', 'rating', 'score', 'nota', 'verde', 'amarelo', 'vermelho', 'bloqueio', 'reputacao', 'reputação'],
    answer: `O **Quality Rating** é a nota oficial que a Meta dá para o seu número com base nos últimos 7 dias de envios:

• **Verde (Alta qualidade):** Seu número cumpre as diretrizes e os clientes estão recebendo bem as mensagens (leituras e respostas altas).
• **Amarelo (Média qualidade):** Houve denúncias de spam ou bloqueios recentes por alguns contatos. Recomenda-se pausar envios frios e revisar o texto.
• **Vermelho (Baixa qualidade):** Alto índice de bloqueios e denúncias. Risco de redução imediata do limite diário ou suspensão temporária pela Meta.`,
  },
  {
    id: 'criar_template',
    question: 'Como cadastrar e aprovar um novo modelo de mensagem (Template)?',
    shortLabel: 'Como aprovar novo template',
    keywords: ['template', 'templates', 'modelo', 'modelos', 'aprovar template', 'criar template', 'cadastrar template', 'mensagem pronta', 'meta aprovar'],
    answer: `Para cadastrar e aprovar um template para disparos:

1. Acesse o menu **Templates** na barra lateral.
2. Clique em **"Novo Template"**.
3. Escolha a categoria (ex: **Marketing** para ofertas ou **Utilidade** para confirmações).
4. Escreva a mensagem e use a variável **{{nome}}** para que cada cliente receba o texto personalizado.
5. Clique em **"Enviar para Aprovação"**. O algoritmo da Meta analisa e geralmente aprova em **poucos minutos**!`,
  },
  {
    id: 'conectar_meta',
    question: 'Como conectar a conta da Meta / WhatsApp Oficial?',
    shortLabel: 'Como conectar conta da Meta',
    keywords: ['conectar', 'conexao', 'conexão', 'vincular', 'meta', 'whatsapp', 'waba', 'configurar whatsapp', 'qrcode', 'conta meta', 'conectar meta'],
    answer: `Para conectar seu número de WhatsApp Oficial da Meta:

1. Acesse o menu **Configurações** na barra lateral.
2. Localize a seção **Conexão Meta (WhatsApp Cloud API)**.
3. Clique em **"Conectar com a Meta"** (fluxo oficial via Embedded Signup do Facebook).
4. Faça login na sua conta empresarial da Meta e selecione o número da sua empresa.
5. Autorize as permissões. Ao finalizar, o status mudará para **Conectada** e seu número estará liberado para disparos!`,
  },
  {
    id: 'variavel_nome',
    question: 'Por que é importante colocar {{nome}} nos templates?',
    shortLabel: 'Por que usar {{nome}} no template',
    keywords: ['nome', 'variavel', 'variável', 'chave', 'template', 'modelo', 'personalizar', 'spam', 'personalizacao', 'personalização'],
    answer: `A variável **{{nome}}** é indispensável por 3 grandes razões:

1. **Proteção Anti-Spam da Meta:** Se você enviar centenas de mensagens com texto 100% idêntico, a Meta classifica como disparo massivo robótico. Com o {{nome}}, cada mensagem se torna única no algoritmo da Meta.
2. **Triplica as Respostas:** Clientes respondem muito mais quando veem seu próprio nome no início da mensagem (*"Olá Carlos!"*).
3. **Automação Domu:** No momento do disparo, nossa plataforma substitui automaticamente o {{nome}} pelo nome real do lead importado da sua planilha!`,
  },
  {
    id: 'importar_planilha',
    question: 'Como importar contatos de planilha Excel ou CSV?',
    shortLabel: 'Como importar contatos do Excel',
    keywords: ['planilha', 'excel', 'csv', 'contatos', 'importar', 'subir', 'base', 'leads', 'lista', 'arquivo'],
    answer: `Importar sua lista de contatos para o Domu é simples e rápido:

1. Acesse o menu **Contatos** na barra lateral.
2. Clique no botão **"Importar contatos"** (ou arraste sua planilha .xlsx ou .csv).
3. O sistema aceita planilhas com colunas como **Nome**, **Telefone / WhatsApp**, **E-mail** e **Tags/Interesse**.
4. O Domu formata automaticamente o código do país (55) e o DDD para garantir que a Meta entregue as mensagens sem erros.`,
  },
  {
    id: 'coexistencia',
    question: 'O que é o modo Coexistência e como funciona no meu celular?',
    shortLabel: 'Modo Coexistência no celular',
    keywords: ['celular', 'coexistencia', 'coexistência', 'aparelho', 'sincronizar', '14 dias', 'smartphone', 'whatsapp celular', 'whatsapp business'],
    answer: `O **Modo Coexistência** é um recurso oficial da Meta que permite que você:

• Continue usando o aplicativo **WhatsApp Business no celular normalmente** para conversar 1 a 1 com clientes, mandar áudios e ver fotos.
• Ao mesmo tempo, use a **plataforma Domu Tech no computador** para disparos em massa automáticos e gestão de campanhas pela API Oficial.
• **Regra dos 14 dias:** Basta abrir o WhatsApp no seu celular pelo menos 1 vez a cada 14 dias para manter a sincronização ativa com a Meta.`,
  },
  {
    id: 'evitar_bloqueios',
    question: 'Quais são as melhores práticas para evitar bloqueios no WhatsApp?',
    shortLabel: 'Como evitar bloqueios de chip',
    keywords: ['evitar bloqueio', 'bloqueio', 'banir', 'banimento', 'proibido', 'seguranca', 'segurança', 'denuncia', 'denúncia', 'cuidados'],
    answer: `Dicas de ouro para manter seu número 100% seguro:

1. **Use apenas listas próprias:** Nunca compre listas de contatos frios que não conhecem sua empresa.
2. **Sempre use {{nome}}:** Mensagens personalizadas evitam a detecção de envio massivo pela Meta.
3. **Respeite a cota diária:** Nosso sistema já avisa seu saldo de 24h antes do envio para não ultrapassar o limite oficial.
4. **Respeite horários comerciais:** Evite disparar tarde da noite ou em horários invasivos para não receber denúncias.
5. **Dê opção de saída:** Permita que o lead diga se não deseja mais receber novidades.`,
  },
  {
    id: 'janela_24h',
    question: 'Como funciona a janela de atendimento de 24 horas?',
    shortLabel: 'Janela de atendimento de 24 horas',
    keywords: ['janela', '24 horas', '24h', 'sessao', 'sessão', 'resposta', 'gratis', 'grátis', 'tempo'],
    answer: `A **Janela de 24 Horas** é o período oficial da Meta que começa no momento em que um contato responde a uma mensagem da sua empresa.

Dentro dessa janela de 24 horas:
• Você pode trocar quantas mensagens de texto e áudio desejar.
• Não há cobrança de novas taxas de disparo de marketing pela Meta para essas mensagens de resposta.
• É o momento ideal para o corretor conduzir a negociação diretamente no WhatsApp!`,
  },
];

function getTopicIcon(labelOrId: string) {
  const normalized = labelOrId.toLowerCase();
  if (normalized.includes('disparo') || normalized.includes('campanha') || normalized.includes('enviar')) {
    return <Send className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('conectar') || normalized.includes('conexao') || normalized.includes('vincular')) {
    return <Link2 className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('aprovar') || normalized.includes('novo template')) {
    return <FileText className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('limite') || normalized.includes('subir')) {
    return <TrendingUp className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('cobranca') || normalized.includes('cobrança')) {
    return <CreditCard className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('qualidade') || normalized.includes('verde')) {
    return <Activity className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('nome') || normalized.includes('template')) {
    return <Tag className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('excel') || normalized.includes('planilha') || normalized.includes('contatos')) {
    return <FileSpreadsheet className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('celular') || normalized.includes('coexistencia') || normalized.includes('coexistência')) {
    return <Smartphone className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('bloqueio') || normalized.includes('evitar')) {
    return <ShieldAlert className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('janela') || normalized.includes('24 horas') || normalized.includes('24h')) {
    return <Clock className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  return <HelpCircle className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
}

const STOP_WORDS = new Set([
  'como', 'fazer', 'faco', 'faço', 'quero', 'saber', 'para', 'onde', 'qual', 'quais', 'quem',
  'com', 'por', 'que', 'uma', 'uns', 'umas', 'meu', 'minha', 'meus', 'minhas', 'ele',
  'ela', 'eles', 'elas', 'isso', 'esse', 'essa', 'esses', 'essas', 'aqui', 'sobre',
  'tenho', 'tem', 'ter', 'pode', 'posso', 'consigo', 'dar', 'deu', 'vai', 'vou', 'voce',
  'você', 'eu', 'um', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'e', 'ou',
  'se', 'ja', 'já', 'so', 'só', 'tudo', 'todos', 'toda', 'todas', 'ola', 'olá', 'bom', 'dia',
  'tarde', 'noite', 'ajuda', 'ajudar'
]);

function findBestAnswer(query: string): FAQItem | null {
  const clean = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let bestMatch: FAQItem | null = null;
  let maxScore = 0;

  // Palavras significativas da busca ignorando stop words
  const searchWords = clean
    .split(/[\s,?.!;:]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  for (const item of FAQ_KNOWLEDGE_BASE) {
    let score = 0;

    // 1. Match em palavras-chave específicas do item (peso alto)
    for (const kw of item.keywords) {
      const cleanKw = kw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Frase/termo exato contido na mensagem digitada
      if (clean.includes(cleanKw)) {
        score += cleanKw.length > 5 ? 10 : 6;
      }

      // Palavras individuais da busca batendo com keyword
      for (const word of searchWords) {
        if (cleanKw === word) {
          score += 5;
        } else if (cleanKw.includes(word) && word.length >= 4) {
          score += 2;
        }
      }
    }

    // 2. Match nas palavras significativas da pergunta (excluindo stop words)
    const cleanQuestionWords = item.question
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[\s,?.!;:]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

    for (const word of searchWords) {
      if (cleanQuestionWords.includes(word)) {
        score += 3;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  return maxScore >= 4 ? bestMatch : null;
}

export default function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'Olá! Sou o assistente de suporte da **Domu Tech**.\n\nEstou aqui para tirar dúvidas sobre o sistema, regras da Meta, limites diários, aprovação de templates e cobrança.\n\nEscolha um dos tópicos rápidos abaixo ou digite sua dúvida:',
      options: FAQ_KNOWLEDGE_BASE.slice(0, 5).map((f) => f.shortLabel),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = (userText: string) => {
    const text = userText.trim();
    if (!text) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, sender: 'user', text },
    ];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const lowerText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Verifica se o usuário pediu diretamente para falar com suporte/humano/atendente
      const isAskingForHuman = [
        'atendente',
        'humano',
        'contato',
        'falar com alguem',
        'falar com alguém',
        'falar com suporte',
        'pessoa',
        'telefone',
        'whatsapp',
        'zap',
        'ajuda humana',
      ].some((term) => lowerText.includes(term));

      let botReply: Message;

      if (isAskingForHuman) {
        botReply = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `Com certeza! Você pode falar diretamente com a nossa equipe de suporte pelo WhatsApp.\n\nClique no botão abaixo para iniciar seu atendimento:`,
          showWhatsAppLink: true,
          whatsAppCustomText: `Olá suporte Domu Tech! Gostaria de falar com um atendente sobre a minha conta.`,
          options: FAQ_KNOWLEDGE_BASE.slice(0, 3).map((f) => f.shortLabel),
        };
      } else {
        // Procura se clicou em uma opção pré-definida ou fez busca semântica
        const foundByShortLabel = FAQ_KNOWLEDGE_BASE.find(
          (f) => f.shortLabel.toLowerCase() === text.toLowerCase()
        );
        const match = foundByShortLabel || findBestAnswer(text);

        if (match) {
          botReply = {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: match.answer,
            showWhatsAppLink: false,
            options: FAQ_KNOWLEDGE_BASE.filter((f) => f.id !== match.id)
              .slice(0, 3)
              .map((f) => f.shortLabel),
          };
        } else {
          // Quando NÃO souber responder: fala para entrar em contato com o suporte!
          botReply = {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: `Ainda não tenho a resposta exata para essa dúvida por aqui.\n\nPor favor, **entre em contato com a nossa equipe de suporte** pelo WhatsApp para te ajudarmos com isso agora mesmo:`,
            options: FAQ_KNOWLEDGE_BASE.slice(0, 4).map((f) => f.shortLabel),
            showWhatsAppLink: true,
            whatsAppCustomText: `Olá suporte Domu Tech! Estava no sistema com uma dúvida: "${text}" e gostaria da ajuda de um atendente.`,
          };
        }
      }

      setMessages((prev) => [...prev, botReply]);
      setIsTyping(false);
    }, 450);
  };

  const handleReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: 'Conversa reiniciada! Como posso te ajudar agora? Escolha um tema ou digite sua pergunta:',
        options: FAQ_KNOWLEDGE_BASE.slice(0, 5).map((f) => f.shortLabel),
      },
    ]);
  };

  return (
    <>
      {/* Botão Flutuante no Canto Inferior Direito: Ícone azul de fone arredondado + texto 'SUPORTE' embaixo */}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col items-center gap-1.5 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer relative ${
            isOpen
              ? 'bg-slate-800 text-white hover:bg-slate-900 border-2 border-slate-700'
              : 'bg-domu-blue hover:bg-blue-700 text-white border-2 border-white'
          }`}
          title={isOpen ? 'Fechar Suporte' : 'Abrir Suporte e Atendimento Domu Tech'}
          aria-label={isOpen ? 'Fechar Suporte' : 'Abrir Suporte'}
        >
          {isOpen ? (
            <X className="w-6 h-6 transition-transform rotate-0" />
          ) : (
            <Headset className="w-7 h-7 text-white" />
          )}
        </button>

        {/* Texto "SUPORTE" abaixo do ícone com cantos arredondados */}
        <span className="text-[11px] font-extrabold text-slate-800 bg-white/95 px-3 py-0.5 rounded-full shadow-md border border-slate-200/90 tracking-wide uppercase">
          Suporte
        </span>
      </div>

      {/* Janela de Chat Flutuante com Cantos Arredondados */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Suporte Domu Tech"
          className="fixed bottom-24 right-4 sm:right-6 z-[999] w-[375px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-7.5rem)] rounded-2xl shadow-2xl border border-slate-200/90 bg-white flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200 font-sans"
        >
          {/* Header do Chat */}
          <div className="bg-[#0B132B] text-white px-4 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
                <Headset className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight">
                  Suporte Domu Tech
                </h3>
                <p className="text-[10px] text-slate-300">
                  Respostas instantâneas sobre a Meta e a Plataforma
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                type="button"
                onClick={handleReset}
                title="Reiniciar conversa"
                className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fechar chat"
                className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensagens (Scrollable) */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/60 text-xs">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs leading-relaxed whitespace-pre-line ${
                      isBot
                        ? 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                        : 'bg-domu-blue text-white rounded-tr-xs font-medium'
                    }`}
                  >
                    {/* Render simples com negrito e tópicos */}
                    <div className="space-y-1.5">
                      {msg.text.split('\n').map((line, idx) => {
                        if (!line.trim()) return <div key={idx} className="h-1.5" />;
                        // Substitui markdown básico de negrito **texto**
                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <p key={idx} className={line.startsWith('•') ? 'pl-2' : ''}>
                            {parts.map((p, pIdx) => {
                              if (p.startsWith('**') && p.endsWith('**')) {
                                return (
                                  <strong
                                    key={pIdx}
                                    className={isBot ? 'font-bold text-slate-900' : 'font-bold text-white'}
                                  >
                                    {p.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return <span key={pIdx}>{p}</span>;
                            })}
                          </p>
                        );
                      })}
                    </div>

                    {/* Botão de Atendimento no WhatsApp (Sem expor o número visualmente) */}
                    {isBot && msg.showWhatsAppLink && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        <a
                          href={CONTACT_WHATSAPP_URL(
                            msg.whatsAppCustomText ||
                              'Olá suporte Domu Tech! Gostaria de falar com um atendente sobre a minha conta.'
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-domu-blue hover:bg-blue-700 text-white font-bold text-[11px] transition-colors shadow-xs cursor-pointer"
                        >
                          <Headset className="w-4 h-4" />
                          <span>Entrar em contato no WhatsApp</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Chips de Opções Rápidas com Ícones e sem emojis */}
                  {isBot && msg.options && msg.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
                      {msg.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSend(opt)}
                          className="px-3 py-1.5 bg-white hover:bg-blue-50 hover:border-domu-blue/60 border border-slate-200/90 text-slate-700 hover:text-domu-blue rounded-full text-[11px] font-semibold transition-all shadow-2xs flex items-center gap-1.5 text-left cursor-pointer"
                        >
                          {getTopicIcon(opt)}
                          <span>{opt}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Indicador de digitando */}
            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 bg-white border border-slate-200/80 px-3 py-2 rounded-2xl rounded-tl-xs w-20">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: '150ms' }}
                ></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: '300ms' }}
                ></span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Campo de Entrada de Texto */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua dúvida (ex: limite, cobrança)..."
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-xl focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="w-9 h-9 flex items-center justify-center bg-domu-blue hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors cursor-pointer shrink-0"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Rodapé sutil com suporte oficial (sem expor o número visualmente) */}
          <div className="px-3.5 py-2 bg-slate-100/90 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-medium">Suporte Oficial Domu Tech</span>
            <a
              href={CONTACT_WHATSAPP_URL()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-domu-blue hover:underline font-bold flex items-center gap-0.5"
            >
              Falar no WhatsApp ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
}
