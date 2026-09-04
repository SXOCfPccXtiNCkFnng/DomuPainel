/** Canais de contato oficiais da Domu Tech — usados em e-mails e documentos legais. */
export const CONTACT_EMAIL = 'contato@domutech.digital';
export const CONTACT_WHATSAPP_NUMBER = '5511934430659';
export const CONTACT_WHATSAPP_URL = (text?: string) =>
  `https://wa.me/${CONTACT_WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
