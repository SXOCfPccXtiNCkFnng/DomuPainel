/** UFs brasileiras válidas. */
export const BR_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrUf = (typeof BR_UFS)[number];

const CITY_NAME_RE = /^[A-Za-zÀ-ÿ]+(?:[ '\-.][A-Za-zÀ-ÿ]+)*$/;

/**
 * Aceita: "São Paulo, SP" | "São Paulo - SP" | "São Paulo/SP" | "São Paulo SP"
 */
export function parseCityState(input: string): { city: string; uf: BrUf } | null {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const match = raw.match(/^(.+?)[\s]*[,/\-–—][\s]*([A-Za-z]{2})$/)
    || raw.match(/^(.+?)\s+([A-Za-z]{2})$/);

  if (!match) return null;

  const city = match[1].trim();
  const uf = match[2].trim().toUpperCase() as BrUf;

  if (!BR_UFS.includes(uf)) return null;
  if (city.length < 2 || city.length > 60) return null;
  if (!CITY_NAME_RE.test(city)) return null;

  return { city, uf };
}

export function formatCityState(city: string, uf: string): string {
  return `${city.trim()}, ${uf.trim().toUpperCase()}`;
}

export function validateCityState(input: string): { ok: true; formatted: string } | { ok: false; error: string } {
  const parsed = parseCityState(input);
  if (!parsed) {
    return {
      ok: false,
      error: 'Informe cidade e UF válidos. Ex: São Paulo, SP',
    };
  }
  return { ok: true, formatted: formatCityState(parsed.city, parsed.uf) };
}

/** Só dígitos do telefone BR (DDD + número). */
export function digitsOnlyPhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, 11);
}

/** Máscara (11) 99999-9999 / (11) 9999-9999 */
export function formatWhatsAppMask(input: string): string {
  const digits = digitsOnlyPhone(input);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

export function validateWhatsAppPhone(
  input: string
): { ok: true; formatted: string; digits: string } | { ok: false; error: string } {
  const digits = digitsOnlyPhone(input);

  if (digits.length < 10 || digits.length > 11) {
    return {
      ok: false,
      error: 'Informe um WhatsApp com DDD e número. Ex: (11) 99999-9999',
    };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) {
    return { ok: false, error: 'DDD inválido. Confira o código da sua cidade.' };
  }

  // Celular BR: 11 dígitos e 3º dígito = 9
  if (digits.length === 11 && digits[2] !== '9') {
    return {
      ok: false,
      error: 'Celular deve ter 9 dígitos após o DDD. Ex: (11) 9XXXX-XXXX',
    };
  }

  return {
    ok: true,
    formatted: formatWhatsAppMask(digits),
    digits,
  };
}
