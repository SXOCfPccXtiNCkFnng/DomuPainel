'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Key,
  CheckCircle2,
  ExternalLink,
  Phone,
  Copy,
  Save,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import CoexistenceWidget from '@/components/dashboard/CoexistenceWidget';
import TeamSettingsPanel from '@/components/configuracoes/TeamSettingsPanel';
import ProfileSettingsPanel from '@/components/configuracoes/ProfileSettingsPanel';
import { getAuthItem, setAuthItem } from '@/lib/authStorage';
import { User } from 'lucide-react';

export default function ConfiguracoesPage() {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [activeSection, setActiveSection] = useState<'profile' | 'meta' | 'team'>('profile');

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch(`/api/settings/whatsapp?tenantId=${tenantId}`);
      const json = await res.json();
      if (json.success && json.settings) {
        const s = json.settings;
        setWhatsappPhone(s.whatsappPhone || '');
        setPhoneNumberId(s.phoneNumberId || '');
        setWabaId(s.wabaId || '');
        setHasToken(Boolean(s.hasToken));
        setAccessToken(s.hasToken ? '••••••••••••••••' : '');
        if (s.whatsappPhone) setAuthItem('domu_whatsapp_phone', s.whatsappPhone);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Não foi possível carregar as configurações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    setSavedSuccess(false);
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          whatsappPhone,
          phoneNumberId,
          wabaId,
          accessToken: accessToken.includes('•') ? '' : accessToken,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || 'Falha ao salvar.');
        return;
      }
      if (whatsappPhone) setAuthItem('domu_whatsapp_phone', whatsappPhone);
      setSavedSuccess(true);
      setHasToken(Boolean(phoneNumberId && wabaId));
      if (accessToken && !accessToken.includes('•')) {
        setAccessToken('••••••••••••••••');
      }
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro de conexão ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyValue = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2 lg:sticky lg:top-6 self-start">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`w-full text-left px-4 py-3 rounded-2xl border text-xs font-bold transition-colors ${
              activeSection === 'profile'
                ? 'bg-blue-50 border-blue-100 text-domu-blue'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <User className="w-4 h-4" />
              Meu Perfil
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('meta')}
            className={`w-full text-left px-4 py-3 rounded-2xl border text-xs font-bold transition-colors ${
              activeSection === 'meta'
                ? 'bg-blue-50 border-blue-100 text-domu-blue'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Key className="w-4 h-4" />
              Integração Meta
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('team')}
            className={`w-full text-left px-4 py-3 rounded-2xl border text-xs font-bold transition-colors ${
              activeSection === 'team'
                ? 'bg-blue-50 border-blue-100 text-domu-blue'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Equipe e permissões
            </span>
          </button>
        </aside>

        <div className="space-y-6">
          <div className={activeSection === 'profile' ? 'block' : 'hidden'}>
            <ProfileSettingsPanel />
          </div>

          <div className={activeSection === 'meta' ? 'block space-y-8' : 'hidden'}>
            {/* Header */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-1">
                Integração WhatsApp
              </p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Conexão com a Meta
              </h1>
              <p className="text-sm text-slate-500 mt-1.5 max-w-lg">
                Configure aqui o número e as credenciais que a DOMU usa para enviar mensagens pela API oficial do WhatsApp.
              </p>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-100 uppercase">
                API Oficial
              </span>
              <span className="px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Qualidade · Verde
              </span>
            </div>

            {/* Coexistence widget */}
            <CoexistenceWidget />

            {/* Tips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: 'App no celular', text: 'Continue respondendo conversas no WhatsApp Business normalmente.' },
                { title: 'Envios em massa', text: 'As campanhas são enviadas pelos servidores oficiais da Meta com segurança.' },
                { title: 'Regra dos 14 dias', text: 'Abra o WhatsApp no celular pelo menos a cada 14 dias para manter o vínculo ativo.' },
              ].map((item) => (
                <div key={item.title} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1.5">
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Credentials form */}
            <form
              onSubmit={handleSave}
              className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-domu-blue" />
                    Credenciais da API
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {isLoading
                      ? 'Carregando…'
                      : hasToken
                        ? 'Suas credenciais estão salvas e criptografadas.'
                        : 'Preencha os campos abaixo e salve para conectar.'}
                  </p>
                </div>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-domu-blue px-4 py-2.5 rounded-xl border border-slate-200 hover:border-domu-blue/40 transition-colors"
                >
                  Abrir Meta Developers
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="p-6 space-y-6">
                {/* WhatsApp number */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Número do WhatsApp comercial
                  </label>
                  <input
                    type="text"
                    placeholder="+55 11 99999-8888"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
                  />
                </div>

                {/* IDs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-slate-600">
                        ID do Número (Phone Number ID)
                      </label>
                      {phoneNumberId && (
                        <button
                          type="button"
                          onClick={() => copyValue('phone', phoneNumberId)}
                          className="text-[10px] font-bold text-domu-blue flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          {copied === 'phone' ? 'Copiado' : 'Copiar'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="Ex: 109848492049281"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-domu-blue/30"
                    />
                    <p className="text-[10px] text-slate-400">Encontrado no painel da Meta em WhatsApp &gt; Configuração da API.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-slate-600">
                        ID da Conta WhatsApp (WABA)
                      </label>
                      {wabaId && (
                        <button
                          type="button"
                          onClick={() => copyValue('waba', wabaId)}
                          className="text-[10px] font-bold text-domu-blue flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          {copied === 'waba' ? 'Copiado' : 'Copiar'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="Ex: 998341029348123"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-domu-blue/30"
                    />
                    <p className="text-[10px] text-slate-400">Identificador da sua conta comercial do WhatsApp na Meta.</p>
                  </div>
                </div>

                {/* Token */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-600">
                    Token de acesso (Access Token)
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={hasToken ? 'Token salvo — cole um novo para substituir' : 'Cole aqui o token gerado na Meta'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-domu-blue/30"
                  />
                  <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    O token é criptografado antes de ser salvo. Para trocar, cole um novo e clique em salvar.
                  </p>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  {savedSuccess ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Configurações salvas com sucesso!
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      As alterações só entram em vigor depois de salvar.
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving || isLoading}
                    className="btn-domu-primary text-xs py-2.5 px-6 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar configurações
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className={activeSection === 'team' ? 'block' : 'hidden'}>
            <TeamSettingsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
