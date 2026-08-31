import type { Metadata } from 'next';
import './globals.css';
import AppLayoutGuard from '@/components/layout/AppLayoutGuard';

export const metadata: Metadata = {
  title: 'Plataforma Domu Tech',
  description: 'Sua plataforma completa de divulgação, disparos e atendimento no WhatsApp.',
  icons: {
    icon: '/fraucon.png',
    shortcut: '/fraucon.png',
    apple: '/fraucon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="icon" href="/fraucon.png" sizes="any" />
        <link rel="shortcut icon" href="/fraucon.png" />
        <link rel="apple-touch-icon" href="/fraucon.png" />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 font-sans antialiased">
        <AppLayoutGuard>
          {children}
        </AppLayoutGuard>
      </body>
    </html>
  );
}
