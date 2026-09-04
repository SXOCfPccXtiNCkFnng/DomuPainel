'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Shield,
  X,
} from 'lucide-react';
import { formatPhoneBR, validatePhoneBR } from '@/lib/validators';

type ProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  companyName: string;
  whatsappNumber: string;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  BROKER: 'Corretor',
  ATTENDANT: 'Atendente',
};

export default function ProfileSettingsPanel() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Editable fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [cancelModalError, setCancelModalError] = useState('');

  const loadSubscriptionStatus = async () => {
    try {
      const res = await fetch('/api/subscription');
      const json = await res.json();
      if (json.success && json.subscription?.status) {
        setSubscriptionStatus(json.subscription.status);
      }
    } catch {
      /* ignore */
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setCancelModalError('');
    setError('');
    try {
      const res = await fetch('/api/subscription', { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        setCancelModalError(json.error || 'Não foi possível cancelar.');
        return;
      }
      setShowCancelModal(false);
      setSubscriptionStatus('CANCELED');
      setSuccess(
        json.message ||
          'Assinatura cancelada. As cobranças mensais foram encerradas.'
      );
    } catch {
      setCancelModalError('Erro de conexão ao cancelar.');
    } finally {
      setCancelling(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/profile');
      const json = await res.json();
      if (json.success && json.profile) {
        setProfile(json.profile);
        setName(json.profile.name);
        setPhone(json.profile.phone || '');
      } else {
        setError(json.error || 'Não foi possível carregar o perfil.');
      }
    } catch {
      setError('Erro de conexão ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadSubscriptionStatus();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload: Record<string, string> = {};

    if (name.trim() !== profile?.name) payload.name = name.trim();
    if (phone.trim() && phone.trim() !== (profile?.phone || '')) {
      const phoneCheck = validatePhoneBR(phone);
      if (!phoneCheck.ok) {
        setError(phoneCheck.error || 'Telefone pessoal inválido.');
        setSaving(false);
        return;
      }
      payload.phone = phoneCheck.formatted;
    }

    if (showPasswordForm) {
      if (!currentPassword) {
        setError('Informe a senha atual.');
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setError('A nova senha precisa ter pelo menos 6 caracteres.');
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('A nova senha e a confirmação não coincidem.');
        setSaving(false);
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setError('Nenhuma alteração detectada.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Falha ao salvar.');
      } else {
        setSuccess(json.message || 'Perfil atualizado com sucesso.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
        await loadProfile();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch {
      setError('Erro de conexão ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const createdLabel = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-domu-blue mb-1">
          Conta
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Meu Perfil
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie seus dados pessoais e sua senha de acesso.
        </p>
      </div>

      {/* Info badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-100 uppercase">
          <Shield className="w-3 h-3" />
          {ROLE_LABELS[profile?.role || ''] || profile?.role || '…'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-slate-50 text-slate-600 border border-slate-200 uppercase">
          <Calendar className="w-3 h-3" />
          Membro desde {createdLabel}
        </span>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-domu-blue" />
            Dados pessoais
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? 'Carregando…' : 'Edite seu nome e telefone abaixo.'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Nome completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
            />
          </div>

          {/* E-mail (somente leitura) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              E-mail
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              readOnly
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">
              O e-mail é usado para login e não pode ser alterado por aqui.
            </p>
          </div>

          {/* Telefone pessoal */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Telefone pessoal
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
              maxLength={15}
              placeholder="(11) 99999-8888"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
            />
          </div>

          {/* Empresa (somente leitura) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-600">
                Empresa
              </label>
              <input
                type="text"
                value={profile?.companyName || ''}
                readOnly
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-600">
                WhatsApp comercial
              </label>
              <input
                type="text"
                value={profile?.whatsappNumber || ''}
                readOnly
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400">
                Para trocar, vá em Integração Meta.
              </p>
            </div>
          </div>
        </div>

        {/* Senha */}
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-domu-blue transition-colors"
          >
            <Lock className="w-4 h-4" />
            {showPasswordForm ? 'Cancelar troca de senha' : 'Alterar senha'}
          </button>

          {showPasswordForm && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-slate-600">
                  Senha atual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-600">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mín. 8 chars, maiúscula, número e especial"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-600">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-domu-blue/30 focus:border-domu-blue"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback + Save */}
        <div className="border-t border-slate-100 px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Alterações só valem depois de salvar
            </span>
            <button
              type="submit"
              disabled={saving || loading}
              className="btn-domu-primary text-xs py-2.5 px-5 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar perfil
            </button>
          </div>
        </div>
      </form>

      {/* Cancel subscription — danger zone */}
      {subscriptionStatus === 'CANCELED' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-5 space-y-2">
            <h3 className="text-sm font-black text-slate-900">Assinatura cancelada</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
              As cobranças mensais estão encerradas. Para voltar a disparar campanhas, escolha um plano em{' '}
              <a href="/assinatura" className="font-bold text-domu-blue hover:underline">
                Assinatura e Planos
              </a>
              .
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-red-100 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-5 space-y-3">
            <h3 className="text-sm font-black text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Cancelar assinatura
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
              Encerra as cobranças mensais no Asaas. Os disparos ficam bloqueados até você assinar de novo em{' '}
              <strong>Assinatura e Planos</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setCancelModalError('');
                setShowCancelModal(true);
              }}
              className="text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
            >
              Cancelar minha assinatura
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !cancelling && setShowCancelModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">Cancelar assinatura?</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação encerra as cobranças mensais.
                </p>
              </div>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Ao confirmar, as cobranças no Asaas param e os disparos de campanha ficam bloqueados.
                Você pode assinar novamente quando quiser.
              </p>
              {cancelModalError && (
                <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {cancelModalError}
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Manter assinatura
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelSubscription}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : null}
                  {cancelling ? 'Cancelando…' : 'Sim, cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
