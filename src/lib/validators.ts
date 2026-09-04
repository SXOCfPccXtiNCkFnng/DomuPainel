/**
 * Sanitiza texto deixando apenas dígitos numéricos.
 */
export function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Lista de DDDs válidos no Brasil (Anatel) */
export const VALID_BR_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Aplica máscara visual de telefone brasileiro enquanto o usuário digita:
 * Ex: (11) 99999-9999 (11 dígitos - celular) ou (11) 3333-4444 (10 dígitos - fixo)
 */
export function formatPhoneBR(raw: string): string {
  let digits = onlyDigits(raw);
  
  // Se o usuário colou com 55 no início e mais de 11 dígitos, remove o 55 do Brasil
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  
  // Limita a no máximo 11 dígitos
  digits = digits.slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Validação rigorosa de Telefone / WhatsApp Brasileiro.
 * Checa DDD válido, quantidade de dígitos (10 ou 11), 9º dígito de celular,
 * e rejeita sequências repetidas/fictícias (ex: 11999999999, 00000000000).
 */
export function validatePhoneBR(raw: string): { ok: boolean; formatted: string; digits: string; error?: string } {
  let digits = onlyDigits(raw);
  
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length === 0) {
    return { ok: false, formatted: '', digits: '', error: 'O WhatsApp é obrigatório.' };
  }

  if (digits.length < 10 || digits.length > 11) {
    return {
      ok: false,
      formatted: formatPhoneBR(digits),
      digits,
      error: 'Informe DDD + número (ex: (11) 99999-9999).',
    };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BR_DDDS.has(ddd)) {
    return {
      ok: false,
      formatted: formatPhoneBR(digits),
      digits,
      error: `O DDD (${ddd}) não é válido no Brasil.`,
    };
  }

  // Se tem 11 dígitos (celular), o 3º dígito (primeiro do número) obrigatoriamente deve ser 9
  if (digits.length === 11 && digits[2] !== '9') {
    return {
      ok: false,
      formatted: formatPhoneBR(digits),
      digits,
      error: 'Celulares no Brasil devem começar com o dígito 9 após o DDD.',
    };
  }

  // Se tem 10 dígitos (telefone fixo), o 3º dígito costuma ser entre 2 e 5
  if (digits.length === 10 && !/[2-5]/.test(digits[2])) {
    return {
      ok: false,
      formatted: formatPhoneBR(digits),
      digits,
      error: 'Número fixo inválido. Para celular, inclua o dígito 9.',
    };
  }

  // Rejeita números com todos os dígitos iguais (ex: 11111111111) ou sequências zeradas
  const numberPart = digits.slice(2);
  const allSameNumber = numberPart.split('').every((c) => c === numberPart[0]);
  if (allSameNumber || numberPart === '000000000' || numberPart === '999999999' || numberPart === '123456789') {
    return {
      ok: false,
      formatted: formatPhoneBR(digits),
      digits,
      error: 'Por favor, informe um número de WhatsApp real.',
    };
  }

  return {
    ok: true,
    formatted: formatPhoneBR(digits),
    digits,
  };
}

/** Compatibilidade simples */
export function isValidBrazilianPhone(raw: string): boolean {
  return validatePhoneBR(raw).ok;
}

/**
 * Validação de E-mail com formato e TLD válido.
 */
export function validateEmail(email: string): { ok: boolean; error?: string } {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) {
    return { ok: false, error: 'O e-mail é obrigatório.' };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { ok: false, error: 'Insira um e-mail válido (ex: voce@empresa.com).' };
  }

  return { ok: true };
}

/**
 * Validação de Nome Completo (deve conter nome e sobrenome).
 */
export function validateFullName(name: string): { ok: boolean; error?: string } {
  const clean = String(name || '').trim();
  if (!clean) {
    return { ok: false, error: 'O nome completo é obrigatório.' };
  }

  const parts = clean.split(/\s+/).filter((p) => p.length >= 2);
  if (parts.length < 2) {
    return { ok: false, error: 'Digite seu nome e sobrenome (ex: João Silva).' };
  }

  if (/[0-9!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(clean)) {
    return { ok: false, error: 'O nome não deve conter números ou símbolos.' };
  }

  return { ok: true };
}

/**
 * Validação de Nome da Empresa.
 */
export function validateCompanyName(company: string): { ok: boolean; error?: string } {
  const clean = String(company || '').trim();
  if (!clean) {
    return { ok: false, error: 'O nome da empresa é obrigatório.' };
  }
  if (clean.length < 2) {
    return { ok: false, error: 'O nome da empresa deve ter pelo menos 2 caracteres.' };
  }
  return { ok: true };
}

/** Checagem de comprimento (11 = CPF, 14 = CNPJ). Não valida dígito verificador. */
export function isValidCpfCnpjLength(raw: string): boolean {
  const digits = onlyDigits(raw);
  return digits.length === 11 || digits.length === 14;
}

