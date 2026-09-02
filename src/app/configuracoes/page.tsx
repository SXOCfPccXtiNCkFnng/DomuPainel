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
import { getAuthItem, setAuthItem } from '@/lib/authStorage';

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
    <div className="space-y-6 w-full font-sans">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-1">
          Integração Meta
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Configurações do WhatsApp
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Número conectado e credenciais da Cloud API — salvos no banco da sua conta.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-100 uppercase">
          Cloud API
        </span>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Quality · Verde
        </span>
      </div>

      <CoexistenceWidget />

      {/* Compact coexistence tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            title: 'App no celular',
            text: 'Responda 1:1 no WhatsApp Business normalmente.',
          },
          {
            title: 'Disparos na API',
            text: 'Campanhas em massa passam pelos servidores oficiais da Meta.',
          },
          {
            title: 'Regra dos 14 dias',
            text: 'Abra o app pelo menos a cada 14 dias para manter o vínculo.',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-1"
          >
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {item.title}
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-domu-blue" />
              Credenciais e número
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoading ? 'Carregando…' : hasToken ? 'Credenciais encontradas no banco' : 'Preencha e salve para conectar'}
            </p>
          </div>
          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-domu-blue px-3 py-2 rounded-xl border border-slate-200 hover:border-domu-blue/40"
          >
            Abrir Meta Developers
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Número WhatsApp comercial
            </label>
            <input
              type="text"
              placeholder="+55 11 99999-8888"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase text-slate-600">
                  Phone Number ID
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
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase text-slate-600">
                  WABA ID
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
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-600">
              System User Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={hasToken ? 'Deixe mascarado para manter o token atual' : 'Cole o token da Meta'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-domu-blue/30"
            />
            <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
              <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Token é criptografado no banco. Para trocar, cole um token novo e salve.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {savedSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Salvo no banco com sucesso
              </span>
            ) : (
              <span className="text-xs text-slate-400">Alterações só valem depois de salvar</span>
            )}
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="btn-domu-primary text-xs py-2.5 px-5 inline-flex items-center gap-1.5 disabled:opacity-50"
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

      <TeamSettingsPanel />
    </div>
  );
}
