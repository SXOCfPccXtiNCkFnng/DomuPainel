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
  Check,
  CreditCard,
  Loader2,
  Unplug,
  Zap,
} from 'lucide-react';
import CoexistenceWidget from '@/components/dashboard/CoexistenceWidget';
import Disclosure from '@/components/shared/Disclosure';
import TeamSettingsPanel from '@/components/configuracoes/TeamSettingsPanel';
import ProfileSettingsPanel from '@/components/configuracoes/ProfileSettingsPanel';
import { MetaConnectButton, MetaConnectResult } from '@/components/shared/MetaConnectButton';
import { getAuthItem, setAuthItem } from '@/lib/authStorage';
import { reopenFirstSteps } from '@/lib/firstSteps';
import { useRouter } from 'next/navigation';
import { User, ListChecks } from 'lucide-react';

export default function ConfiguracoesPage() {
  const router = useRouter();
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
  const [isMetaConnected, setIsMetaConnected] = useState<boolean | null>(null);
  const [connectionMode, setConnectionMode] = useState<'COEXISTENCE' | 'DIRECT_API'>('COEXISTENCE');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [statusWidgetKey, setStatusWidgetKey] = useState(0);
  const [showManualCredentials, setShowManualCredentials] = useState(false);

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
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('secao') === 'meta') {
      setActiveSection('meta');
    }
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
      if (json.warning) setErrorMsg(json.warning);
      setSavedSuccess(true);
      // Credenciais novas: o quadro de status confere a conexão de novo.
      setStatusWidgetKey((k) => k + 1);
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

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setDisconnectError('');
    try {
      const res = await fetch('/api/settings/whatsapp', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!json.success) {
        setDisconnectError(json.error || 'Não foi possível desconectar.');
        return;
      }
      setAuthItem('domu_whatsapp_phone', '');
      setWhatsappPhone('');
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setHasToken(false);
      setConfirmDisconnect(false);
      setIsMetaConnected(false);
      // Remonta o quadro de status para ele buscar a situação nova.
      setStatusWidgetKey((k) => k + 1);
    } catch {
      setDisconnectError('Erro de conexão ao desconectar.');
    } finally {
      setIsDisconnecting(false);
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

          <button
            type="button"
            onClick={() => {
              reopenFirstSteps(getAuthItem('domu_tenant_id') || 'local');
              router.push('/');
            }}
            className="w-full text-left px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-slate-300 transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Ver primeiros passos
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
            </div>

            {/* Coexistence widget (só renderiza quando conectado) */}
            <CoexistenceWidget key={statusWidgetKey} onStatusChange={setIsMetaConnected} />

            {isMetaConnected === false && (
              <div className="space-y-5">
                {/* Mode picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setConnectionMode('COEXISTENCE')}
                    className={`text-left p-5 border-2 rounded-2xl transition-all space-y-2 bg-white relative ${
                      connectionMode === 'COEXISTENCE'
                        ? 'border-domu-blue shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {connectionMode === 'COEXISTENCE' && (
                      <div className="absolute top-3 right-3 bg-domu-blue text-white p-1 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Recomendado
                    </p>
                    <h3 className="text-sm font-bold text-slate-900">Continuar com seu WhatsApp atual</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Mantém o app no celular funcionando e conecta o mesmo número à plataforma (Coexistência oficial Meta).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConnectionMode('DIRECT_API')}
                    className={`text-left p-5 border-2 rounded-2xl transition-all space-y-2 bg-white relative ${
                      connectionMode === 'DIRECT_API'
                        ? 'border-domu-blue shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {connectionMode === 'DIRECT_API' && (
                      <div className="absolute top-3 right-3 bg-domu-blue text-white p-1 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Alta escala
                    </p>
                    <h3 className="text-sm font-bold text-slate-900">Número dedicado para automação</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Número exclusivo, sem coexistência com o app. Ideal para volume alto e vários operadores.
                    </p>
                  </button>
                </div>

                {connectionMode === 'COEXISTENCE' ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-domu-blue flex items-center justify-center">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Login oficial da Meta</h4>
                        <p className="text-xs text-slate-500">Escolha seu número e autorize — o app no celular continua funcionando.</p>
                      </div>
                    </div>
                    <MetaConnectButton
                      whatsappPhone={whatsappPhone}
                      onConnected={(result: MetaConnectResult) => {
                        if (result.whatsappPhone) {
                          setWhatsappPhone(result.whatsappPhone);
                          setAuthItem('domu_whatsapp_phone', result.whatsappPhone);
                        }
                        setWabaId(result.wabaId);
                        setPhoneNumberId(result.phoneNumberId);
                        setHasToken(true);
                        setIsMetaConnected(true);
                      }}
                      className="btn-domu-primary text-sm py-3 px-6"
                    />
                    {/* Número já ligado à API por outro sistema: conecta com o token,
                        sem refazer o QR code. Continua em coexistência. */}
                    <button
                      type="button"
                      onClick={() => setShowManualCredentials((v) => !v)}
                      className="block text-[11px] font-bold text-slate-500 hover:text-domu-blue"
                    >
                      {showManualCredentials ? 'Ocultar conexão por token' : 'Avançado: conectar com token da Meta'}
                    </button>
                    {showManualCredentials ? (
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Para quem já tem o número ligado à API oficial. Preencha o formulário abaixo — o app no celular
                        continua funcionando normalmente.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Número novo, só na plataforma</h4>
                        <p className="text-xs text-slate-500">
                          Adicione o número e confirme com o código que a Meta envia por SMS ou ligação.
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      Use um número que <strong>não</strong> esteja no app do WhatsApp (de preferência um chip novo).
                      Depois de conectado, ele funciona só pela plataforma — o app do celular deixa de usar esse
                      número.
                    </p>
                    <MetaConnectButton
                      mode="DEDICATED"
                      whatsappPhone={whatsappPhone}
                      label="Conectar número dedicado"
                      onConnected={(result: MetaConnectResult) => {
                        if (result.whatsappPhone) {
                          setWhatsappPhone(result.whatsappPhone);
                          setAuthItem('domu_whatsapp_phone', result.whatsappPhone);
                        }
                        setWabaId(result.wabaId);
                        setPhoneNumberId(result.phoneNumberId);
                        setHasToken(true);
                        setIsMetaConnected(true);
                      }}
                      className="btn-domu-primary text-sm py-3 px-6"
                    />
                    <button
                      type="button"
                      onClick={() => setShowManualCredentials((v) => !v)}
                      className="block text-[11px] font-bold text-slate-500 hover:text-domu-blue"
                    >
                      {showManualCredentials ? 'Ocultar conexão por token' : 'Avançado: conectar com token da Meta'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Já conectado: desconectar libera o fluxo de conexão (trocar de número,
                renovar acesso ou voltar a receber mensagens). */}
            {isMetaConnected && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <Unplug className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Desconectar WhatsApp</h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Para trocar de número ou conectar de novo (por exemplo, se as mensagens dos clientes pararam de
                        chegar). Seus contatos, campanhas e configurações continuam salvos.
                      </p>
                    </div>
                  </div>
                  {!confirmDisconnect && (
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(true)}
                      className="px-4 py-2.5 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 shrink-0"
                    >
                      Desconectar
                    </button>
                  )}
                </div>

                {confirmDisconnect && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-3">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      <strong>Tem certeza?</strong> Até você conectar de novo, a plataforma não envia campanhas
                      (inclusive as agendadas), follow-ups nem mensagens, e não recebe as respostas dos clientes. O app
                      no seu celular continua funcionando normalmente.
                    </p>
                    {disconnectError ? <p className="text-xs text-red-600">{disconnectError}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Sim, desconectar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDisconnect(false);
                          setDisconnectError('');
                        }}
                        disabled={isDisconnecting}
                        className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 bg-white rounded-xl"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Antes de conectar (coexistência): o que muda no dia a dia */}
            {isMetaConnected === false && connectionMode === 'COEXISTENCE' && (
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
            )}

            {/* Conectado: IDs só para consulta (trocar de número = desconectar e conectar de novo). */}
            {isMetaConnected && (
              <Disclosure
                icon={<Key className="w-4 h-4" />}
                title="Detalhes técnicos"
                subtitle="IDs da conexão com a Meta — o suporte pode pedir"
              >
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {[
                    { key: 'phone', label: 'ID do número (Phone Number ID)', value: phoneNumberId },
                    { key: 'waba', label: 'ID da conta WhatsApp (WABA)', value: wabaId },
                  ].map((item) => (
                    <div key={item.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <dt className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                        {item.label}
                        {item.value ? (
                          <button
                            type="button"
                            onClick={() => copyValue(item.key, item.value)}
                            className="text-[10px] font-bold text-domu-blue flex items-center gap-1 normal-case"
                          >
                            <Copy className="w-3 h-3" />
                            {copied === item.key ? 'Copiado' : 'Copiar'}
                          </button>
                        ) : null}
                      </dt>
                      <dd className='text-xs font-mono text-slate-800 mt-1 break-all'>{item.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[11px] text-slate-500 mt-3">
                  Para trocar de número, use <strong>Desconectar</strong> acima e conecte de novo.
                </p>
              </Disclosure>
            )}

            {/* Número dedicado: credenciais coladas à mão — único caso em que o formulário aparece. */}
            {isMetaConnected === false && showManualCredentials && (
              <form
                onSubmit={handleSave}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
              >
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Key className="w-4 h-4 text-domu-blue" />
                      Credenciais da API (avançado)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {isLoading
                        ? 'Carregando…'
                        : hasToken
                          ? 'Suas credenciais estão salvas e criptografadas.'
                          : 'Cole os IDs e o token gerados na Meta. Funciona para número em coexistência ou dedicado.'}
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
                    {/* Não é digitado: ao salvar, o número vem da própria Meta (conferido
                        pelo ID do número), sempre no formato oficial. */}
                    <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                      {whatsappPhone ? (
                        <span className="font-mono text-sm text-slate-900">{whatsappPhone}</span>
                      ) : (
                        'Preenchido automaticamente pela Meta ao salvar, a partir do ID do número.'
                      )}
                    </p>
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
            )}

            {/* Explicações da Meta: consulta, ficam recolhidas. */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">Dúvidas frequentes</p>
              <Disclosure icon={<CreditCard className="w-4 h-4" />} title="Como funciona a cobrança da Meta?">
                <div className="space-y-2 text-[11.5px] text-slate-600 leading-relaxed pt-2">
                  <p>
                    Para campanhas (categoria <em>Marketing</em>), a Meta cobra por conversa iniciada — cerca de R$ 0,30 a
                    R$ 0,35 por contato no Brasil — e exige um <strong>cartão de crédito cadastrado</strong> no WhatsApp
                    Manager para as mensagens serem entregues.
                  </p>
                  <p>
                    <strong>Dica de economia:</strong> quando o cliente responde, abre uma janela de 24 horas em que você
                    conversa à vontade sem cobrança adicional.
                  </p>
                  <a
                    href="https://business.facebook.com/latest/whatsapp_manager/overview/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-domu-blue hover:underline"
                  >
                    Abrir pagamentos no WhatsApp Manager
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </Disclosure>
              <Disclosure icon={<Zap className="w-4 h-4" />} title="Como aumentar o limite diário?" subtitle="250 → 1.000 → 10.000 → 100.000, automático">
                <div className="space-y-3 text-[11.5px] text-slate-600 leading-relaxed pt-2">
                  <p>Você não precisa pedir nem pagar nada à Meta. O limite sobe sozinho quando o número cumpre 3 condições:</p>
                  <ol className="space-y-1.5 list-decimal pl-4">
                    <li><strong>Qualidade alta (verde):</strong> use o nome do cliente e envie só para quem demonstrou interesse.</li>
                    <li><strong>Usar a cota atual:</strong> enviar pelo menos metade do limite em até 7 dias (ex.: mais de 125 quando estiver em 250).</li>
                    <li><strong>Esperar até 48h:</strong> com boa aceitação, a Meta libera o próximo patamar.</li>
                  </ol>
                </div>
              </Disclosure>
            </div>
          </div>

          <div className={activeSection === 'team' ? 'block' : 'hidden'}>
            <TeamSettingsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
