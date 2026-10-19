import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppLayoutGuard from '@/components/layout/AppLayoutGuard';
import PwaSetup from '@/components/layout/PwaSetup';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Plataforma Domu Tech',
  description: 'Sua plataforma completa de divulgação, disparos e atendimento no WhatsApp.',
  icons: {
    icon: '/fraucon.png',
    shortcut: '/fraucon.png',
    apple: '/fraucon.png',
  },
  appleWebApp: { capable: true, title: 'Domu', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="icon" href="/fraucon.png" sizes="any" />
        <link rel="shortcut icon" href="/fraucon.png" />
        <link rel="apple-touch-icon" href="/fraucon.png" />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 font-sans antialiased">
        <PwaSetup />
        <AppLayoutGuard>
          {children}
        </AppLayoutGuard>
      </body>
    </html>
  );
}
