export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'domu_theme';

/** Roda no <head> antes da pintura: sem isso a página pisca branca ao abrir no escuro. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* navegação privada sem storage: vale só até recarregar */
  }
}
