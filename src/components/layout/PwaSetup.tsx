'use client';

import { useEffect } from 'react';
import { captureInstallPrompt, registerServiceWorker } from '@/lib/pwaClient';

/** Registra o service worker e guarda o convite de instalação assim que o painel abre. */
export default function PwaSetup() {
  useEffect(() => {
    const stop = captureInstallPrompt();
    registerServiceWorker();
    return stop;
  }, []);
  return null;
}
