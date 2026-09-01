'use client';

import React, { useRef, useState } from 'react';
import { Link2, Upload, Loader2, X, ImageIcon } from 'lucide-react';

interface ImageSourceFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
}

export default function ImageSourceField({
  value,
  onChange,
  label = 'Imagem do banner',
  hint,
  required = false,
}: ImageSourceFieldProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultHint =
    'A Meta exige uma URL pública HTTPS. Você pode colar um link ou enviar um arquivo — nós geramos a URL para você.';

  const handleUpload = async (file: File) => {
    setUploadError('');
    setIsUploading(true);

    try {
      const tenantId = localStorage.getItem('domu_tenant_id') || 'default';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', tenantId);

      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setUploadError(json.error || 'Falha no upload.');
        return;
      }

      onChange(json.url);
      setMode('url');
    } catch {
      setUploadError('Erro ao enviar arquivo. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (file) handleUpload(file);
  };

  const clearImage = () => {
    onChange('');
    setUploadError('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-600">{label}</label>
        {value && (
          <button
            type="button"
            onClick={clearImage}
            className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />
            Remover
          </button>
        )}
      </div>

      <div className="flex border border-slate-200 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
            mode === 'url' ? 'bg-domu-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 border-l border-slate-200 transition-colors ${
            mode === 'upload' ? 'bg-domu-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
      </div>

      {mode === 'url' ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://suaempresa.com/banner.jpg"
          required={required && !value}
          className="w-full px-3 py-2 bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-domu-blue focus:ring-1 focus:ring-domu-blue/30"
        />
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFileSelect(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-domu-blue bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFileSelect(e.target.files)}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-domu-blue" />
              <span className="text-xs">Enviando imagem...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-500">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-700">
                Clique ou arraste uma imagem
              </span>
              <span className="text-[10px]">JPG, PNG ou WebP · máx. 5 MB</span>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-[10px] text-red-600">{uploadError}</p>
      )}

      {value && (
        <div className="flex items-center gap-3 p-2 border border-slate-200 bg-white">
          <div className="w-14 h-10 bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-slate-600 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              Imagem selecionada
            </p>
            <p className="text-[10px] text-slate-400 truncate font-mono">{value}</p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-500 leading-relaxed">
        {hint || defaultHint}
      </p>
    </div>
  );
}
