import { onlyDigits } from '@/lib/validators';

export type ListedWhatsappPhone = {
  id: string;
  wabaId: string;
  displayPhoneNumber?: string | null;
};

/** Dígitos nacionais (sem 55) para comparar o número digitado com o da Meta. */
export function nationalPhoneDigits(raw: string): string {
  let digits = onlyDigits(raw);
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

export function sameWhatsappNumber(left: string, right: string): boolean {
  const a = nationalPhoneDigits(left);
  const b = nationalPhoneDigits(right);
  return a.length >= 10 && a === b;
}

/**
 * Escolhe o número onboardado quando a Meta não devolve phone_number_id.
 * Um único número na conta é o da coexistência. Vários só fecham se um bater
 * com o WhatsApp informado no cadastro.
 */
export function pickOnboardedPhone(
  phones: ListedWhatsappPhone[],
  typedPhone?: string | null
): ListedWhatsappPhone | 'none' | 'ambiguous' {
  if (phones.length === 0) return 'none';
  if (phones.length === 1) return phones[0];

  const typed = typedPhone?.trim();
  if (!typed) return 'ambiguous';

  const matches = phones.filter(
    (phone) => phone.displayPhoneNumber && sameWhatsappNumber(phone.displayPhoneNumber, typed)
  );
  if (matches.length === 1) return matches[0];
  return 'ambiguous';
}
