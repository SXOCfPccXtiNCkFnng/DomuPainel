import type { MetadataRoute } from 'next';

/** Permite instalar o painel como app (tela inicial do celular) — necessário para notificações no iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Domu Tech',
    short_name: 'Domu',
    description: 'Sua plataforma completa de divulgação, disparos e atendimento no WhatsApp.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#ffffff',
    lang: 'pt-BR',
    icons: [{ src: '/fraucon.png', sizes: '500x500', type: 'image/png', purpose: 'any' }],
  };
}
