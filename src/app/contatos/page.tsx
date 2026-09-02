'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  Search,
  Send,
  Phone,
  CheckSquare,
  Square,
  Pencil,
  X,
  Tags,
} from 'lucide-react';
import ImportContactsModal from '@/components/disparos/ImportContactsModal';
import { getAuthItem } from '@/lib/authStorage';
import {
  INTEREST_OPTIONS,
  REGION_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  LEAD_STATUS_OPTIONS,
  formatBudget,
} from '@/lib/contactTags';

interface LeadContact {
  id: string;
  name: string;
  phone: string;
  status?: string;
  interest_segment?: string | null;
  region?: string | null;
  interest_property_type?: string | null;
  budget_max?: number | null;
  created_at?: string;
}

const selectClass =
  'px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-domu-blue';

function formatPhoneDisplay(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return phone || '—';
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterInterest, setFilterInterest] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editing, setEditing] = useState<LeadContact | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    interest: '',
    region: '',
    propertyType: '',
    budgetMax: '',
    status: 'NOVO',
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const params = new URLSearchParams({ tenantId });
      if (filterInterest) params.set('interest', filterInterest);
      if (filterRegion) params.set('region', filterRegion);
      if (filterType) params.set('propertyType', filterType);
      if (filterBudget) params.set('budgetMax', filterBudget);
      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setContacts(json.leads || []);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [filterInterest, filterRegion, filterType, filterBudget]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        c.region?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const openEdit = (contact: LeadContact) => {
    setEditing(contact);
    setEditForm({
      name: contact.name || '',
      interest: contact.interest_segment || '',
      region: contact.region || '',
      propertyType: contact.interest_property_type || '',
      budgetMax: contact.budget_max != null ? String(contact.budget_max) : '',
      status: contact.status || 'NOVO',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          id: editing.id,
          updates: {
            name: editForm.name,
            interest: editForm.interest || null,
            region: editForm.region || null,
            propertyType: editForm.propertyType || null,
            budgetMax: editForm.budgetMax || null,
            status: editForm.status,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(null);
        await fetchContacts();
      } else {
        alert(json.error || 'Erro ao salvar.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar contato.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteContacts = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Remover ${ids.length} contato(s)?`)) return;
    setIsDeleting(true);
    try {
      const tenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ids }),
      });
      const json = await res.json();
      if (json.success) await fetchContacts();
      else alert(json.error || 'Não foi possível remover.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Base de Contatos
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {contacts.length} cadastrado{contacts.length === 1 ? '' : 's'} · tags e filtros
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Contatos e Segmentação
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/disparos"
            className="px-3.5 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 text-domu-blue" />
            Ir para Disparos
          </Link>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Importar Contatos
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 space-y-3 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, telefone ou região..."
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue/30"
              />
            </div>
            <button
              type="button"
              onClick={fetchContacts}
              className="px-3 py-2 text-xs font-bold text-domu-blue hover:bg-blue-50 rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => deleteContacts(Array.from(selectedIds))}
                className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover ({selectedIds.size})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Tags className="w-3 h-3" /> Segmentar
            </span>
            <select
              value={filterInterest}
              onChange={(e) => setFilterInterest(e.target.value)}
              className={selectClass}
            >
              <option value="">Interesse</option>
              {INTEREST_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className={selectClass}
            >
              <option value="">Região</option>
              {REGION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={selectClass}
            >
              <option value="">Tipo imóvel</option>
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={filterBudget}
              onChange={(e) => setFilterBudget(e.target.value)}
              className={selectClass}
            >
              <option value="">Faixa de preço</option>
              {BUDGET_OPTIONS.map((o) => (
                <option key={o.max} value={o.max}>
                  {o.label}
                </option>
              ))}
            </select>
            {(filterInterest || filterRegion || filterType || filterBudget) && (
              <button
                type="button"
                onClick={() => {
                  setFilterInterest('');
                  setFilterRegion('');
                  setFilterType('');
                  setFilterBudget('');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-domu-blue"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Carregando contatos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 text-domu-blue rounded-full flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-900">Nenhum contato neste filtro</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Importe contatos e edite as tags (interesse, região, preço) para segmentar disparos.
            </p>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="btn-domu-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Importar Contatos
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-y border-slate-200">
                  <th className="py-2.5 px-3 w-10">
                    <button type="button" onClick={toggleAllFiltered} className="text-domu-blue">
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Nome</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3">Interesse</th>
                  <th className="py-2.5 px-3">Região</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Orçamento</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((contact) => {
                  const selected = selectedIds.has(contact.id);
                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-slate-50/80 ${selected ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <button type="button" onClick={() => toggleOne(contact.id)}>
                          {selected ? (
                            <CheckSquare className="w-4 h-4 text-domu-blue" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{contact.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {formatPhoneDisplay(contact.phone)}
                        </span>
                      </td>
                      <td className="py-3 px-3">{contact.interest_segment || '—'}</td>
                      <td className="py-3 px-3">{contact.region || '—'}</td>
                      <td className="py-3 px-3">{contact.interest_property_type || '—'}</td>
                      <td className="py-3 px-3">{formatBudget(contact.budget_max)}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                          {LEAD_STATUS_OPTIONS.find((s) => s.value === contact.status)?.label ||
                            contact.status ||
                            'NOVO'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => openEdit(contact)}
                          className="inline-flex items-center gap-1 text-domu-blue hover:bg-blue-50 px-2 py-1 rounded-lg font-bold"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Tags
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => deleteContacts([contact.id])}
                          className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-[99999] bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Editar tags do contato</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nome</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Interesse
                  </label>
                  <select
                    value={editForm.interest}
                    onChange={(e) => setEditForm((f) => ({ ...f, interest: e.target.value }))}
                    className={`w-full ${selectClass}`}
                  >
                    <option value="">—</option>
                    {INTEREST_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Região
                  </label>
                  <select
                    value={editForm.region}
                    onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
                    className={`w-full ${selectClass}`}
                  >
                    <option value="">—</option>
                    {REGION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Tipo
                  </label>
                  <select
                    value={editForm.propertyType}
                    onChange={(e) => setEditForm((f) => ({ ...f, propertyType: e.target.value }))}
                    className={`w-full ${selectClass}`}
                  >
                    <option value="">—</option>
                    {PROPERTY_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Orçamento máx.
                  </label>
                  <select
                    value={editForm.budgetMax}
                    onChange={(e) => setEditForm((f) => ({ ...f, budgetMax: e.target.value }))}
                    className={`w-full ${selectClass}`}
                  >
                    <option value="">—</option>
                    {BUDGET_OPTIONS.map((o) => (
                      <option key={o.max} value={o.max}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Status no funil
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className={`w-full ${selectClass}`}
                >
                  {LEAD_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={saveEdit}
                className="btn-domu-primary text-xs py-2 px-4 disabled:opacity-50"
              >
                {isSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportContactsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchContacts}
      />
    </div>
  );
}
