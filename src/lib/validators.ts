export function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Telefone BR: DDD (2) + número (8 ou 9 dígitos), com ou sem código do país (55).
 * Ex.: 11987654321 (11) · 1132345678 (10) · 5511987654321 (13, com 55).
 */
export function isValidBrazilianPhone(raw: string): boolean {
  const digits = onlyDigits(raw);
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  return local.length === 10 || local.length === 11;
}

/** Checagem de comprimento (11 = CPF, 14 = CNPJ). Não valida dígito verificador. */
export function isValidCpfCnpjLength(raw: string): boolean {
  const digits = onlyDigits(raw);
  return digits.length === 11 || digits.length === 14;
}
