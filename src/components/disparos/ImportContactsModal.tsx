'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Upload, FileText, CheckCircle2, RefreshCw, Info, FileSpreadsheet } from 'lucide-react';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportContactsModal({ isOpen, onClose, onSuccess }: ImportContactsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'TYPE' | 'CSV'>('TYPE');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedContacts, setParsedContacts] = useState<{ name: string; phone: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  // Helper parser for pasted text or CSV text
  const parseRawTextToContacts = (text: string): { name: string; phone: string }[] => {
    const lines = text.split(/\r?\n/);
    const result: { name: string; phone: string }[] = [];

    lines.forEach((line) => {
      const clean = line.trim();
      if (!clean) return;

      // Check delimiters: comma, semicolon, tab, or colon
      let name = 'Contato';
      let phone = '';

      if (clean.includes(',')) {
        const parts = clean.split(',');
        name = parts[0].trim();
        phone = parts[1]?.trim() || parts[0].trim();
      } else if (clean.includes(';')) {
        const parts = clean.split(';');
        name = parts[0].trim();
        phone = parts[1]?.trim() || parts[0].trim();
      } else if (clean.includes('\t')) {
        const parts = clean.split('\t');
        name = parts[0].trim();
        phone = parts[1]?.trim() || parts[0].trim();
      } else {
        phone = clean;
      }

      // Extract only digits
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 8) {
        result.push({
          name: name.replace(/[0-9]/g, '').trim() || 'Contato WhatsApp',
          phone: digits
        });
      }
    });

    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const contacts = parseRawTextToContacts(text);
        setParsedContacts(contacts);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let contactsToSubmit: { name: string; phone: string }[] = [];
    if (activeTab === 'TYPE') {
      contactsToSubmit = parseRawTextToContacts(pasteText);
    } else {
      contactsToSubmit = parsedContacts;
    }

    if (contactsToSubmit.length === 0) {
      alert('Nenhum contato válido encontrado. Verifique o texto ou o arquivo CSV.');
      return;
    }

    setIsImporting(true);
    setSuccessMsg('');

    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          contacts: contactsToSubmit
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`${contactsToSubmit.length} contatos salvos com sucesso na sua conta DOMU Tech!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1400);
      } else {
        alert(json.error || 'Erro ao importar contatos.');
      }
    } catch (err) {
      console.error('Erro ao salvar contatos:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const modalMarkup = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
      
      {/* Clean Square Card without rounded borders */}
      <div className="bg-white rounded-none border-0 shadow-2xl max-w-lg w-full p-7 space-y-5 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-domu-blue flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Importar ou Digitar Contatos</h3>
              <p className="text-xs text-slate-500 font-medium">Salva os contatos permanentemente na sua conta</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Manual Paste vs File Upload */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('TYPE')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'TYPE' ? 'bg-white text-domu-blue shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Digitar / Colar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CSV')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'CSV' ? 'bg-white text-domu-blue shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Arquivo CSV / TXT</span>
          </button>
        </div>

        {/* Smart DDI Info Banner */}
        <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200/80 text-xs text-slate-700 space-y-1">
          <div className="flex items-center gap-1.5 font-black text-domu-blue">
            <Info className="w-4 h-4 shrink-0" />
            <span>Formato e Código de País (+55 Brasil)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Você pode digitar o número com ou sem o <strong>55</strong> (ex: <code className="bg-white px-1 font-mono text-domu-blue rounded">11999998888</code> ou <code className="bg-white px-1 font-mono text-domu-blue rounded">5511999998888</code>). O sistema adiciona o código 55 automaticamente se faltar!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* TAB 1: Manual Paste */}
          {activeTab === 'TYPE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Cole a lista de contatos (Um por linha: Nome, Telefone)
              </label>
              <textarea
                rows={6}
                required
                placeholder={`Carlos Silva, 11999998888\nMariana Souza, 5511988887777\n11977776666`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full p-3.5 text-xs border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 font-mono bg-white shadow-xs"
              />
            </div>
          )}

          {/* TAB 2: CSV / TXT File Upload */}
          {activeTab === 'CSV' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 block">
                Selecione o arquivo exportado (.csv ou .txt do WhatsApp/Excel)
              </label>

              <label className="border-2 border-dashed border-slate-300 hover:border-domu-blue rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all text-center">
                <Upload className="w-8 h-8 text-domu-blue" />
                <div>
                  <p className="text-xs font-black text-slate-900">Clique para selecionar o arquivo</p>
                  <p className="text-[11px] text-slate-500">Suporta arquivos .CSV e .TXT</p>
                </div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between">
                  <span className="truncate">{fileName}</span>
                  <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded font-black text-emerald-900">
                    {parsedContacts.length} contatos encontrados
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Success Message Feedback */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isImporting}
              className="btn-domu-primary text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Salvar Contatos na Conta</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
