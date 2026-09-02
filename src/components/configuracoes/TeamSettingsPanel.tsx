'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  last_login_at?: string | null;
};

type TeamInvite = {
  id: string;
  name: string;
  email: string;
  role: string;
  expires_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  BROKER: 'Corretor',
  ATTENDANT: 'Atendente',
};

export default function TeamSettingsPanel() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [roles, setRoles] = useState<string[]>(['ADMIN', 'BROKER', 'ATTENDANT']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('BROKER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/team');
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Sem permissão para gerenciar equipe.');
        setUsers([]);
        setInvites([]);
        return;
      }
      setUsers(json.users || []);
      setInvites(json.invites || []);
      if (json.roles?.length) setRoles(json.roles);
    } catch {
      setError('Falha ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    setLastInviteUrl('');
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Não foi possível convidar.');
        return;
      }
      setSuccess(json.message || 'Convite criado.');
      if (json.inviteUrl) setLastInviteUrl(json.inviteUrl);
      setName('');
      setEmail('');
      await load();
    } catch {
      setError('Erro de conexão ao convidar.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId: string, nextRole: string) => {
    setError('');
    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: nextRole }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error || 'Falha ao alterar role.');
      return;
    }
    await load();
  };

  const removeUser = async (userId: string) => {
    if (!confirm('Remover este usuário da conta?')) return;
    const res = await fetch(`/api/team?userId=${userId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) {
      setError(json.error || 'Falha ao remover.');
      return;
    }
    await load();
  };

  const cancelInvite = async (inviteId: string) => {
    const res = await fetch(`/api/team?inviteId=${inviteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) {
      setError(json.error || 'Falha ao cancelar convite.');
      return;
    }
    await load();
  };

  const copyInvite = async () => {
    if (!lastInviteUrl) return;
    await navigator.clipboard.writeText(lastInviteUrl);
    setSuccess('Link do convite copiado.');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-domu-blue" />
            Equipe e permissões
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Convide corretores (BROKER) e atendentes (ATTENDANT). Só ADMIN gerencia.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs font-bold text-domu-blue inline-flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}
        {lastInviteUrl && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <span className="font-mono text-slate-600 truncate flex-1">{lastInviteUrl}</span>
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex items-center gap-1 font-bold text-domu-blue shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar link
            </button>
          </div>
        )}

        <form onSubmit={invite} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[11px] font-bold uppercase text-slate-600">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              placeholder="Nome"
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[11px] font-bold uppercase text-slate-600">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              placeholder="email@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-slate-600">Papel</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-domu-primary text-xs py-2.5 px-4 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Enviando…' : 'Convidar'}
          </button>
        </form>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Membros</h4>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-white"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] || r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <p className="text-xs text-slate-400 px-4 py-6 text-center">Nenhum usuário.</p>
            )}
          </div>
        </div>

        {invites.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Convites pendentes
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {inv.name}{' '}
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 ml-1">
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {inv.email} · expira {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelInvite(inv.id)}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
