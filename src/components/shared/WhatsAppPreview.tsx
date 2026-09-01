'use client';

import React from 'react';

export interface WhatsAppPreviewProps {
  bodyText: string;
  imageUrl?: string;
  showImage?: boolean;
  contactName?: string;
  companyLabel?: string;
  buttonText?: string;
  footer?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

function WhatsAppCheckmarks() {
  return (
    <svg viewBox="0 0 16 11" className="w-3.5 h-2.5 text-[#53bdeb]" fill="currentColor">
      <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.158.487.487 0 0 0-.105.354.476.476 0 0 0 .142.338l2.78 2.628a.48.48 0 0 0 .336.14.47.47 0 0 0 .347-.158l6.522-8.06a.48.48 0 0 0 .063-.522.467.467 0 0 0-.132-.172z" />
      <path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-9.19 11.336-1.405-1.328a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.158.487.487 0 0 0-.105.354.476.476 0 0 0 .142.338l1.78 1.684a.48.48 0 0 0 .336.14.47.47 0 0 0 .347-.158l9.522-11.76a.48.48 0 0 0 .063-.522.467.467 0 0 0-.132-.172z" transform="translate(-2.5 0)" />
    </svg>
  );
}

export function renderTemplateVariables(
  text: string,
  vars: Record<string, string> = {}
): string {
  const defaults: Record<string, string> = {
    nome: 'Cliente',
    horario: '15:00',
    produto: 'Oferta Especial',
    valor: 'R$ 299,00',
    empresa: 'Sua Empresa',
    imovel: 'Produto Premium',
    bairro: 'Centro',
    ...vars,
  };

  let result = text;
  Object.entries(defaults).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
  });
  return result;
}

export default function WhatsAppPreview({
  bodyText,
  imageUrl,
  showImage = false,
  contactName = 'Sua Empresa',
  companyLabel = 'Atendimento Oficial',
  buttonText,
  footer,
  className = '',
  compact = false,
}: WhatsAppPreviewProps) {
  const initials = contactName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'DM';

  const displayText = bodyText.trim() || 'Digite o texto da mensagem para visualizar o preview...';

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          Preview WhatsApp
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Ao vivo</span>
      </div>

      <div className={`mx-auto w-full ${compact ? 'max-w-[240px]' : 'max-w-[260px]'}`}>
        <div className="border border-slate-300 bg-slate-900 p-[3px] shadow-sm">
          <div className="overflow-hidden bg-[#0b141a]">

            <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2.5 border-b border-white/5">
              <div className="w-8 h-8 rounded-full bg-domu-blue flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#e9edef] leading-tight truncate">{contactName}</p>
                <p className="text-[10px] text-[#8696a0]">{companyLabel}</p>
              </div>
            </div>

            <div
              className={`relative flex flex-col justify-end p-2.5 ${compact ? 'min-h-[200px]' : 'min-h-[240px]'}`}
              style={{ backgroundColor: '#0b141a' }}
            >
              <div className="relative max-w-[95%]">
                <div className="bg-[#1f2c34] overflow-hidden">
                  {showImage && imageUrl && (
                    <div className="w-full aspect-[16/9] bg-[#2a3942] overflow-hidden">
                      <img
                        src={imageUrl}
                        alt="Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="px-2.5 py-2">
                    <p className="text-[12px] text-[#e9edef] leading-[1.4] whitespace-pre-wrap break-words">
                      {displayText}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <WhatsAppCheckmarks />
                    </div>
                  </div>

                  {buttonText && (
                    <div className="border-t border-white/5 py-2 text-center text-[12px] font-medium text-[#53bdeb]">
                      {buttonText}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-200 space-y-0.5 text-center">
          {footer}
        </div>
      )}
    </div>
  );
}
