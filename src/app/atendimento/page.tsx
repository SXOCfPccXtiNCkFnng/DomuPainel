'use client';

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Clock, 
  Send, 
  User, 
  Building2, 
  Phone, 
  Search, 
  CheckCheck, 
  Tag, 
  ArrowUpRight, 
  Lock,
  Smile,
  Paperclip,
  Mic,
  MoreVertical,
  Calendar,
  DollarSign,
  ShieldCheck,
  Check
} from 'lucide-react';
import { mockLeads } from '@/lib/mockData';

interface ChatMessage {
  id: string;
  sender: 'lead' | 'broker' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
}

export default function AtendimentoPage() {
  const [activeLeadId, setActiveLeadId] = useState(mockLeads[0].id);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({
    'lead-1': [
      {
        id: 'm1',
        sender: 'system',
        senderName: 'DOMU SaaS',
        text: 'Hoje • Disparo de Alerta Enviado via Meta Cloud API Oficial',
        timestamp: '14:30'
      },
      {
        id: 'm2',
        sender: 'broker',
        senderName: 'Alan (Corretor DOMU)',
        text: 'Olá Carlos Eduardo! Vi que você tem interesse no imóvel Apartamento 3 suítes no Residencial Horizon Tower. Acabamos de liberar 2 unidades exclusivas em andar alto! Podemos agendar uma visita presencial amanhã?',
        timestamp: '14:30',
        status: 'READ'
      },
      {
        id: 'm3',
        sender: 'lead',
        senderName: 'Carlos Eduardo Silva',
        text: 'Olá Alan! Tenho sim bastante interesse. Qual é a taxa de condomínio e quais horários você tem livres amanhã no período da tarde?',
        timestamp: '14:32'
      }
    ],
    'lead-2': [
      {
        id: 'm1',
        sender: 'system',
        senderName: 'DOMU SaaS',
        text: 'Ontem • Disparo de Lançamento Enviado',
        timestamp: '10:15'
      },
      {
        id: 'm2',
        sender: 'broker',
        senderName: 'Alan (Corretor DOMU)',
        text: 'Olá Mariana! A proposta da Casa Alphaville foi enviada para o proprietário. Em breve retorno com o parecer!',
        timestamp: '10:16',
        status: 'READ'
      },
      {
        id: 'm3',
        sender: 'lead',
        senderName: 'Mariana Oliveira Souza',
        text: 'Perfeito, Alan! Fico no aguardo, obrigada!',
        timestamp: '10:20'
      }
    ],
    'lead-3': [
      {
        id: 'm1',
        sender: 'system',
        senderName: 'DOMU SaaS',
        text: 'Há 3 dias • Contato via Formulário',
        timestamp: '09:00'
      },
      {
        id: 'm2',
        sender: 'lead',
        senderName: 'Roberto Fernando Mendes',
        text: 'Gostaria de receber a apresentação completa do Studio investimento.',
        timestamp: '09:02'
      }
    ]
  });

  const [inputMessage, setInputMessage] = useState('');

  const activeLead = mockLeads.find(l => l.id === activeLeadId) || mockLeads[0];
  const activeChatMessages = messages[activeLeadId] || [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: 'broker',
      senderName: 'Alan (Corretor DOMU)',
      text: inputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'READ'
    };

    setMessages(prev => ({
      ...prev,
      [activeLeadId]: [...(prev[activeLeadId] || []), newMsg]
    }));

    setInputMessage('');
  };

  return (
    <div className="space-y-3 w-full">
      
      {/* Compact Status Banner */}
      <div className="bg-slate-900 text-white py-2 px-4 rounded-md border border-slate-800 flex items-center justify-between text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-amber-500 text-slate-950">
            Em Breve • Versão 2.0
          </span>
          <span className="font-bold text-slate-200">WhatsApp Multiatendente (Central 1:1)</span>
          <span className="hidden sm:inline text-slate-400">• Responda leads diretamente pelo Portal DOMU com histórico unificado</span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>WhatsApp Cloud API Sync</span>
        </div>
      </div>

      {/* Full-Height WhatsApp Web Style Chat Canvas */}
      <div className="bg-white rounded-md border border-slate-200/90 shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-10rem)] min-h-[650px] w-full">
        
        {/* Left Column: Conversations List (3 cols out of 12) */}
        <div className="lg:col-span-3 border-r border-slate-200 bg-slate-50 flex flex-col h-full">
          
          {/* Header */}
          <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-domu-blue" />
                Conversas Recentes ({mockLeads.length})
              </h3>
              <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ● Ao Vivo
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar cliente ou telefone..." 
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded text-xs focus:outline-none focus:border-domu-blue font-medium"
              />
            </div>
          </div>

          {/* Conversations Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {mockLeads.map((lead) => {
              const isActive = activeLeadId === lead.id;
              const leadMessages = messages[lead.id] || [];
              const lastMsg = leadMessages[leadMessages.length - 1];

              return (
                <div 
                  key={lead.id}
                  onClick={() => setActiveLeadId(lead.id)}
                  className={`p-3 cursor-pointer transition-all flex items-start gap-3 ${
                    isActive 
                      ? 'bg-white border-l-4 border-l-domu-blue shadow-xs' 
                      : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-domu-navy text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                      {lead.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{lead.name}</h4>
                      <span className="text-[10px] text-slate-400 font-medium">{lead.lastContactAt}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate font-medium">
                      {lastMsg ? lastMsg.text : `Interessado no ${lead.interestPropertyType}`}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-50 text-domu-blue border border-blue-100">
                        {lead.status}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-mono">WhatsApp Cloud</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Middle Column: WhatsApp Web Main Canvas (6 cols out of 12 - TWICE AS WIDE!) */}
        <div className="lg:col-span-6 flex flex-col h-full bg-[#E5DDD5]/20 border-r border-slate-200">
          
          {/* Active Chat Header */}
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-domu-blue text-white font-black text-xs flex items-center justify-center">
                  {activeLead.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <span>{activeLead.name}</span>
                  <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    Online
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-slate-500">{activeLead.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-500">
              <button title="Coexistência WhatsApp" className="p-1 rounded hover:bg-slate-100 text-xs font-bold text-domu-blue flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Meta Cloud API</span>
              </button>
              <button title="Mais Opções" className="p-1 rounded hover:bg-slate-100">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed Area (WhatsApp Web Pattern) */}
          <div className="flex-1 p-5 space-y-3.5 overflow-y-auto bg-[#F0F2F5]/80">
            
            {activeChatMessages.map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="text-center my-3">
                    <span className="text-[10.5px] bg-white text-slate-500 font-semibold px-3 py-1 rounded-full shadow-xs border border-slate-200">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isBroker = msg.sender === 'broker';

              return (
                <div key={msg.id} className={`flex ${isBroker ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 shadow-xs space-y-1 relative ${
                    isBroker 
                      ? 'bg-[#E7F1FF] text-slate-900 border border-blue-200/80 rounded-tr-none' 
                      : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-none'
                  }`}>
                    
                    <span className={`text-[10px] font-bold block ${isBroker ? 'text-domu-blue' : 'text-slate-500'}`}>
                      {msg.senderName}
                    </span>

                    <p className="text-xs leading-relaxed font-medium">
                      {msg.text}
                    </p>

                    <div className={`flex items-center gap-1 text-[9.5px] mt-1 ${isBroker ? 'justify-end text-slate-500' : 'justify-end text-slate-400'}`}>
                      <span>{msg.timestamp}</span>
                      {isBroker && <CheckCheck className="w-3.5 h-3.5 text-domu-blue" />}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>

          {/* WhatsApp Web Style Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-100 border-t border-slate-200 flex items-center gap-2.5 shrink-0">
            
            <div className="flex items-center gap-1 text-slate-500">
              <button type="button" className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors">
                <Smile className="w-4 h-4" />
              </button>
              <button type="button" className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <input 
              type="text" 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:border-domu-blue font-medium shadow-xs"
            />

            {inputMessage.trim() ? (
              <button 
                type="submit" 
                className="btn-domu-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            ) : (
              <button type="button" className="p-2 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors shrink-0">
                <Mic className="w-4 h-4" />
              </button>
            )}

          </form>

        </div>

        {/* Right Column: Lead CRM Context Profile (3 cols out of 12) */}
        <div className="lg:col-span-3 bg-slate-50 p-4 space-y-4 overflow-y-auto h-full border-l border-slate-200">
          
          {/* Profile Header */}
          <div className="pb-3 border-b border-slate-200 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Perfil do Lead e CRM
            </span>
            <h4 className="text-sm font-black text-slate-900">{activeLead.name}</h4>
            <p className="text-xs font-mono font-bold text-domu-blue">{activeLead.phone}</p>
            <p className="text-xs text-slate-500">{activeLead.email}</p>
          </div>

          {/* Real Estate Intent Details */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Interesse Imobiliário
            </span>
            
            <div className="bg-white p-3 rounded border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Building2 className="w-4 h-4 text-domu-blue shrink-0" />
                <span>{activeLead.interestPropertyType}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Orçamento Max:</span>
                <strong className="text-slate-900 font-black">R$ {activeLead.budgetMax.toLocaleString('pt-BR')}</strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Origem do Lead:</span>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-domu-blue">
                  WhatsApp Disparo
                </span>
              </div>
            </div>
          </div>

          {/* Quick Broker Actions */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Ações Rápidas do Corretor
            </span>

            <button className="w-full py-2 px-3 rounded bg-white border border-slate-200/80 hover:border-domu-blue text-xs font-bold text-slate-800 flex items-center justify-between transition-all shadow-xs">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-domu-blue" />
                Agendar Visita ao Imóvel
              </span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </button>

            <button className="w-full py-2 px-3 rounded bg-white border border-slate-200/80 hover:border-domu-blue text-xs font-bold text-slate-800 flex items-center justify-between transition-all shadow-xs">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Registrar Proposta Comercial
              </span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
