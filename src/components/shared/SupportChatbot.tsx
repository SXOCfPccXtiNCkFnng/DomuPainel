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
import {
  FAQ_KNOWLEDGE_BASE,
  findBestAnswer,
  wantsHumanSupport,
} from '@/lib/supportKnowledge';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: string[];
  showWhatsAppLink?: boolean;
  whatsAppCustomText?: string;
}

function getTopicIcon(labelOrId: string) {
  const normalized = labelOrId.toLowerCase();
  if (normalized.includes('disparo') || normalized.includes('campanha') || normalized.includes('enviar')) {
    return <Send className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('conectar') || normalized.includes('conexao') || normalized.includes('vincular')) {
    return <Link2 className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('rejeitado') || normalized.includes('reprovado')) {
    return <ShieldAlert className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
  }
  if (normalized.includes('por que template') || normalized.includes('obrigatorio') || normalized.includes('obrigatórios')) {
    return <HelpCircle className="w-3.5 h-3.5 text-domu-blue shrink-0" />;
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
  if (normalized.includes('nome')) {
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

  const followUps = (exceptId?: string) =>
    FAQ_KNOWLEDGE_BASE.filter((item) => item.id !== exceptId)
      .slice(0, 3)
      .map((item) => item.shortLabel);

  const pushBot = (reply: Omit<Message, 'id' | 'sender'>) => {
    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, sender: 'bot', ...reply }]);
    setIsTyping(false);
  };

  const handleSend = (userText: string) => {
    const text = userText.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: `user-${Date.now()}`, sender: 'user', text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInputValue('');
    setIsTyping(true);

    const chip = FAQ_KNOWLEDGE_BASE.find((item) => item.shortLabel.toLowerCase() === text.toLowerCase());
    if (chip) {
      pushBot({
        text: chip.answer,
        options: followUps(chip.id),
      });
      return;
    }

    if (wantsHumanSupport(text)) {
      pushBot({
        text: 'Você pode falar direto com a equipe de suporte pelo WhatsApp.\n\nClique no botão abaixo para iniciar o atendimento:',
        showWhatsAppLink: true,
        whatsAppCustomText: 'Olá suporte Domu Tech! Gostaria de falar com um atendente sobre a minha conta.',
        options: followUps(),
      });
      return;
    }

    void (async () => {
      try {
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: history.slice(-8).map((item) => ({ role: item.sender, text: item.text })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.answer) {
          pushBot({
            text: data.answer,
            showWhatsAppLink: Boolean(data.offerHuman),
            whatsAppCustomText: data.offerHuman
              ? `Olá suporte Domu Tech! Estava no sistema com uma dúvida: "${text}" e gostaria da ajuda de um atendente.`
              : undefined,
            options: followUps(),
          });
          return;
        }
      } catch {
        /* cai no FAQ local */
      }

      const match = findBestAnswer(text);
      if (match) {
        pushBot({ text: match.answer, options: followUps(match.id) });
        return;
      }
      pushBot({
        text: 'Ainda não tenho a resposta exata para essa dúvida por aqui.\n\nFale com a equipe de suporte pelo WhatsApp:',
        showWhatsAppLink: true,
        whatsAppCustomText: `Olá suporte Domu Tech! Estava no sistema com uma dúvida: "${text}" e gostaria da ajuda de um atendente.`,
        options: followUps(),
      });
    })();
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
