/**
 * Códigos de 6 dígitos do aplicativo autenticador (TOTP, RFC 6238): o mesmo
 * padrão do Google Authenticator, Microsoft Authenticator, Authy e 1Password.
 * Segredo em base32, passo de 30 s, HMAC-SHA1.
 */
import crypto from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;
/** Aceita o código anterior e o seguinte também (relógio do celular adiantado/atrasado). */
const DRIFT_STEPS = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Segredo novo de 160 bits (o tamanho que os aplicativos esperam). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, '0');
}

export function currentStep(now: number = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Confere o código. Devolve o passo aceito (para gravar e não aceitar o mesmo
 * código de novo) ou null. `lastStep`: último passo já usado por este usuário.
 */
export function verifyTotp(secret: string, code: string, opts?: { now?: number; lastStep?: number | null }): number | null {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const step = currentStep(opts?.now);
  for (let delta = -DRIFT_STEPS; delta <= DRIFT_STEPS; delta++) {
    const candidate = step + delta;
    if (opts?.lastStep != null && candidate <= opts.lastStep) continue;
    const expected = totpCode(secret, candidate);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digits))) return candidate;
  }
  return null;
}

/** Link que o aplicativo autenticador entende (é o conteúdo do QR code). */
export function otpauthUrl(params: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** "JBSW Y3DP EHPK 3PXP" — mais fácil de digitar à mão. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** Códigos de recuperação: 8 de "xxxx-xxxx" (sem letras confusas como 0/O e 1/l). */
export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
