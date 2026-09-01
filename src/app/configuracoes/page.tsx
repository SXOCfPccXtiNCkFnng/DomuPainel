'use client';

import React, { useState } from 'react';
import CoexistenceWidget from '@/components/dashboard/CoexistenceWidget';
import { Settings, ShieldCheck, Smartphone, Key, CheckCircle2, RefreshCw, ExternalLink, Info } from 'lucide-react';
import { mockTenants } from '@/lib/mockData';

export default function ConfiguracoesPage() {
  const tenant = mockTenants[0];
  const [phoneNumberId, setPhoneNumberId] = useState('109848492049281');
  const [wabaId, setWabaId] = useState('998341029348123');
  const [accessToken, setAccessToken] = useState('EAAGk...829374');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 w-full">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-domu-blue/10 text-domu-blue border border-domu-blue/20">
            Coexistência e API
          </span>
          <span className="text-xs text-slate-500 font-medium">Meta Cloud API v20.0</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Configuração da API Oficial e WhatsApp Coexistence
        </h1>
      </div>

      {/* Widget */}
      <CoexistenceWidget />

      {/* Coexistence Guide Card */}
      <div className="card-domu p-6 space-y-4 border-blue-200 bg-blue-50/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-domu-blue text-white flex items-center justify-center shadow-md">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Como funciona a Coexistência no DOMU SaaS</h3>
            <p className="text-xs text-slate-500">O que você precisa saber para disparar sem risco de bloqueio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs font-bold text-domu-blue flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              1. Mantém o App no Celular
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Você continua usando o WhatsApp Business no celular para responder clientes individualmente.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs font-bold text-domu-blue flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              2. Disparos pela Cloud API
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              As campanhas em massa são processadas pelos servidores oficiais da Meta sem passar pela conexão do seu celular.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-xs font-bold text-domu-blue flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              3. Regra dos 14 Dias
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Abra o app no celular semanalmente para manter o vínculo de coexistência ativo no sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Meta API Credentials Form */}
      <div className="card-domu p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-domu-blue" />
              Credenciais da Meta Cloud API
            </h3>
            <p className="text-xs text-slate-500">Chaves de integração do seu app no Meta for Developers</p>
          </div>

          <button 
            type="button"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <span>Iniciar Meta Embedded Signup</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number ID</label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-domu-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp Business Account ID (WABA ID)</label>
              <input
                type="text"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-domu-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">System User Permanent Access Token</label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-domu-blue"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Credenciais salvas com sucesso!
              </span>
            ) : (
              <span className="text-xs text-slate-400">Status da conexão: Autenticado</span>
            )}

            <button
              type="submit"
              className="btn-domu-primary text-xs shadow-md shadow-blue-500/20"
            >
              Salvar Credenciais
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
