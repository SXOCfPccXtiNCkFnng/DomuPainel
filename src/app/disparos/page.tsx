'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Search, 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users,
  FileSpreadsheet,
  Upload,
  X,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import CampaignWizardModal from '@/components/disparos/CampaignWizardModal';

export default function DisparosPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Import Modal state
  const [pasteText, setPasteText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      const res = await fetch(`/api/reports?tenantId=${storedTenantId}`);
      const json = await res.json();
      if (json.success && json.reports?.campaigns) {
        setCampaigns(json.reports.campaigns);
      }
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteText.trim()) return;

    setIsImporting(true);
    setImportSuccessMsg('');

    try {
      const storedTenantId = localStorage.getItem('domu_tenant_id') || '';
      
      // Parse pasted lines: "Nome, Telefone" or "Telefone"
      const lines = pasteText.split('\n');
      const contactsToSave: { name: string; phone: string }[] = [];

      lines.forEach((line) => {
        const clean = line.trim();
        if (!clean) return;

        if (clean.includes(',')) {
          const [name, phone] = clean.split(',');
          contactsToSave.push({ name: name.trim(), phone: phone.trim() });
        } else if (clean.includes(';')) {
          const [name, phone] = clean.split(';');
          contactsToSave.push({ name: name.trim(), phone: phone.trim() });
        } else {
          contactsToSave.push({ name: 'Contato', phone: clean });
        }
      });

      if (contactsToSave.length === 0) return;

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: storedTenantId,
          contacts: contactsToSave
        })
      });
      const json = await res.json();

      if (json.success) {
        setImportSuccessMsg(`${contactsToSave.length} contatos salvos com sucesso na sua conta DOMU Tech!`);
        setPasteText('');
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportSuccessMsg('');
        }, 1500);
      }
    } catch (err) {
      console.error('Erro ao importar contatos:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans">
      
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-domu-blue border border-blue-200 uppercase">
              Motor de Envio Meta API
            </span>
            <span className="text-xs text-slate-500 font-medium">Fila de Disparos em Tempo Real</span>
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Disparos de Mensagens em Massa
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Import Contacts Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-domu-blue" />
            <span>Importar / Digitar Contatos</span>
          </button>

          {/* New Campaign Button (Single Plus Sign!) */}
          <button
            onClick={() => setIsWizardOpen(true)}
            className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* Campaigns Table / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900">Histórico de Disparos Executados</h3>
          <button onClick={fetchCampaigns} className="text-xs font-bold text-domu-blue hover:underline flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar Lista
          </button>
        </div>

        {campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-y border-slate-200">
                  <th className="py-2.5 px-3">Nome da Campanha</th>
                  <th className="py-2.5 px-3">Template Meta</th>
                  <th className="py-2.5 px-3">Destinatários</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Entregues</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{camp.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{camp.templateName}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{camp.sentCount} contatos</td>
                    <td className="py-3 px-3 text-slate-500">{camp.createdAt}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{camp.deliveredCount}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {camp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="w-12 h-12 bg-blue-100 text-domu-blue rounded-full flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900">Nenhum disparo realizado ainda</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Importe seus contatos e clique em <strong>Nova Campanha</strong> para disparar mensagens em massa com modelos aprovados pela Meta.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-white text-slate-700 font-extrabold border border-slate-300 rounded-xl text-xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4 text-domu-blue" />
                <span>Importar Contatos</span>
              </button>

              <button
                onClick={() => setIsWizardOpen(true)}
                className="btn-domu-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Campanha</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal: Importar ou Digitar Contatos (Fixed Full Overlay Backdrop) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border border-slate-200 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-domu-blue" />
                  Importar ou Digitar Contatos
                </h3>
                <p className="text-xs text-slate-500">Salva os contatos na sua conta para futuros disparos</p>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportContacts} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cole ou digite os contatos (Um por linha: Nome, Telefone)</label>
                <textarea
                  rows={6}
                  required
                  placeholder={`Carlos Silva, 11999998888\nMariana Souza, 11988887777\n5511977776666`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full p-3.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-domu-blue text-slate-900 font-mono bg-white"
                />
              </div>

              {importSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-[11.5px] text-slate-600">
                💡 <strong>Dica DOMU:</strong> Todos os contatos que você importar ficam permanentemente salvos na sua conta, dispensando a necessidade de reimportar!
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isImporting}
                  className="btn-domu-primary text-xs py-2.5 px-5 flex items-center gap-1.5 shadow-xs"
                >
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Salvar Contatos na Conta</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Campaign Dispatch Modal */}
      <CampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onStartCampaign={() => fetchCampaigns()}
      />

    </div>
  );
}
