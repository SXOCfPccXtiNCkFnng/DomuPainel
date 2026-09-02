'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UserPlus,
  Upload,
  FileText,
  CheckCircle2,
  RefreshCw,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import { getAuthItem } from '@/lib/authStorage';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportTab = 'TYPE' | 'CSV';

function parseRawTextToContacts(text: string): { name: string; phone: string }[] {
  const lines = text.split(/\r?\n/);
  const result: { name: string; phone: string }[] = [];

  lines.forEach((line, index) => {
    const clean = line.trim();
    if (!clean) return;

    // Skip common CSV header rows
    if (
      index === 0 &&
      /^(nome|name|contato|telefone|phone|celular)/i.test(clean.replace(/["']/g, ''))
    ) {
      return;
    }

    let name = 'Contato';
    let phone = '';

    if (clean.includes(',')) {
      const parts = clean.split(',');
      name = parts[0].trim().replace(/^["']|["']$/g, '');
      phone = (parts[1] || parts[0]).trim().replace(/^["']|["']$/g, '');
    } else if (clean.includes(';')) {
      const parts = clean.split(';');
      name = parts[0].trim().replace(/^["']|["']$/g, '');
      phone = (parts[1] || parts[0]).trim().replace(/^["']|["']$/g, '');
    } else if (clean.includes('\t')) {
      const parts = clean.split('\t');
      name = parts[0].trim();
      phone = (parts[1] || parts[0]).trim();
    } else {
      phone = clean;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 8) {
      result.push({
        name: name.replace(/[0-9]/g, '').trim() || 'Contato WhatsApp',
        phone: digits,
      });
    }
  });

  return result;
}

export default function ImportContactsModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportContactsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ImportTab>('TYPE');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedContacts, setParsedContacts] = useState<{ name: string; phone: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('TYPE');
    setPasteText('');
    setFileName('');
    setParsedContacts([]);
    setSuccessMsg('');
    setErrorMsg('');
    setIsImporting(false);
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setParsedContacts([]);
        setErrorMsg('Não foi possível ler o arquivo.');
        return;
      }
      const contacts = parseRawTextToContacts(text);
      setParsedContacts(contacts);
      if (contacts.length === 0) {
        setErrorMsg('Nenhum contato válido encontrado no arquivo. Use Nome,Telefone por linha.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const contactsToSubmit =
      activeTab === 'TYPE' ? parseRawTextToContacts(pasteText) : parsedContacts;

    if (contactsToSubmit.length === 0) {
      setErrorMsg(
        activeTab === 'TYPE'
          ? 'Cole pelo menos um contato válido (Nome, Telefone).'
          : 'Selecione um arquivo CSV/TXT com contatos válidos.'
      );
      return;
    }

    setIsImporting(true);
    setSuccessMsg('');

    try {
      const storedTenantId = getAuthItem('domu_tenant_id') || '';
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          contacts: contactsToSubmit,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(
          `${json.inserted ?? contactsToSubmit.length} contatos salvos na sua conta.`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        setErrorMsg(json.error || 'Erro ao importar contatos.');
      }
    } catch (err) {
      console.error('Erro ao salvar contatos:', err);
      setErrorMsg('Falha de conexão ao salvar contatos.');
    } finally {
      setIsImporting(false);
    }
  };

  const modalMarkup = (
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 font-sans"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-domu-blue flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Importar Contatos</h3>
              <p className="text-xs text-slate-500 font-medium">
                Salva no banco · tags de interesse você edita depois em Contatos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('TYPE');
              setErrorMsg('');
            }}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'TYPE'
                ? 'bg-white text-domu-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Digitar / Colar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CSV');
              setErrorMsg('');
            }}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'CSV'
                ? 'bg-white text-domu-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Arquivo CSV / TXT
          </button>
        </div>

        <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-100 text-[11px] text-slate-600 leading-relaxed">
          <div className="flex items-center gap-1.5 font-black text-domu-blue mb-1">
            <Info className="w-3.5 h-3.5" />
            Formato · DDI +55
          </div>
          {activeTab === 'TYPE' ? (
            <p>
              Uma linha por contato: <code className="bg-white px-1 rounded font-mono text-domu-blue">Nome, Telefone</code>.
              O 55 é adicionado automaticamente se faltar.
            </p>
          ) : (
            <p>
              Exporte do Excel/WhatsApp em CSV ou TXT com colunas Nome e Telefone (separador vírgula ou
              ponto-e-vírgula). Cabeçalhos são ignorados.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'TYPE' ? (
            <div className="space-y-1.5" key="tab-type">
              <label className="text-xs font-bold text-slate-800">Lista (um por linha)</label>
              <textarea
                rows={10}
                placeholder={`Carlos Silva, 11999998888\nMariana Souza, 5511988887777\n11977776666`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full p-4 text-sm border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-domu-blue font-mono bg-white min-h-[220px]"
              />
              <p className="text-[11px] text-slate-500">
                Depois de salvar, abra cada contato em <strong>Contatos</strong> para definir interesse,
                região e faixa de preço.
              </p>
            </div>
          ) : (
            <div className="space-y-3" key="tab-csv">
              <label className="text-xs font-bold text-slate-800 block">
                Upload do arquivo (.csv ou .txt)
              </label>
              <label className="border-2 border-dashed border-slate-300 hover:border-domu-blue rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-all text-center">
                <Upload className="w-9 h-9 text-domu-blue" />
                <p className="text-xs font-black text-slate-900">Clique para escolher o arquivo</p>
                <p className="text-[11px] text-slate-500">CSV ou TXT · máx. lista por linha</p>
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
                  <span className="truncate">{fileName}</span>
                  <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded font-black text-emerald-900 shrink-0">
                    {parsedContacts.length} contatos
                  </span>
                </div>
              )}

              {parsedContacts.length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-white text-[11px] font-mono divide-y divide-slate-100">
                  {parsedContacts.slice(0, 8).map((c, i) => (
                    <div key={`${c.phone}-${i}`} className="px-3 py-1.5 flex justify-between gap-2">
                      <span className="truncate text-slate-800">{c.name}</span>
                      <span className="text-slate-500 shrink-0">{c.phone}</span>
                    </div>
                  ))}
                  {parsedContacts.length > 8 && (
                    <div className="px-3 py-1.5 text-slate-500 font-sans font-medium">
                      +{parsedContacts.length - 8} outros…
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {successMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-1.5 disabled:opacity-60"
            >
              {isImporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Salvar na conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
