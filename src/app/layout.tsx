import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

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
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Container */}
          <div className="flex-1 pl-64 flex flex-col min-h-screen">
            {/* Header */}
            <Header />

            {/* Main Content Body */}
            <main className="flex-1 pt-24 px-8 pb-12 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
