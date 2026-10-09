/**
 * Telefones de contato (WhatsApp). Um único lugar para gravar e procurar
 * números — antes cada rota fazia a sua variação e um mesmo contato podia
 * não ser encontrado (e, com a captura automática, ser criado em dobro).
 */

/** Formato gravado em `leads.phone`: só dígitos, com 55 quando vier sem DDI. */
export function toStoredPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

/**
 * Todas as formas em que um mesmo número pode estar gravado. Cobre:
 * - com e sem 55 (contatos antigos foram gravados sem DDI);
 * - com e sem o 9 do celular: para muitos números a Meta manda o `from`
 *   sem o 9 (55 11 8765-4321) enquanto a planilha importada tem o 9
 *   (55 11 98765-4321), e vice-versa.
 * Fixo (começa com 2–5 depois do DDD) não ganha 9.
 */
export function phoneLookupVariants(rawPhone: string): string[] {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return [];

  const variants = new Set<string>([digits]);
  const withDdi = toStoredPhone(digits);
  variants.add(withDdi);

  if (withDdi.startsWith('55')) {
    const ddd = withDdi.slice(2, 4);
    const local = withDdi.slice(4);
    if (local.length === 9 && local.startsWith('9')) {
      variants.add(`55${ddd}${local.slice(1)}`);
    } else if (local.length === 8 && /^[6-9]/.test(local)) {
      variants.add(`55${ddd}9${local}`);
    }
  }

  for (const v of Array.from(variants)) {
    if (v.startsWith('55') && v.length >= 12) variants.add(v.slice(2));
  }

  return Array.from(variants);
}
