import type { Metadata } from 'next';
import './globals.css';
import AppLayoutGuard from '@/components/layout/AppLayoutGuard';

export const metadata: Metadata = {
  title: 'DOMU Tech - Portal SaaS Multi-Tenant',
  description: 'Portal de Gestão, Automação e Disparos no WhatsApp com Coexistência e Meta Cloud API Oficial',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 font-sans antialiased">
        <AppLayoutGuard>
          {children}
        </AppLayoutGuard>
      </body>
    </html>
  );
}
