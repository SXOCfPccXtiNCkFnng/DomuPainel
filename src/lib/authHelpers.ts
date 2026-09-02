import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const LEGACY_SALT = 'domu_tech_salt_2026';
const BCRYPT_ROUNDS = 12;
const BCRYPT_PREFIX = '$2';

// Password Validation Rule: Minimum 8 chars, 1 uppercase, 1 number, 1 special char
export function isPasswordStrong(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'A senha deve conter no mínimo 8 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter pelo menos uma letra maiúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter pelo menos um número.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter pelo menos um caractere especial (!@#$%^&*).' };
  }
  return { valid: true };
}

function hashPasswordLegacy(password: string): string {
  return crypto.createHash('sha256').update(password + LEGACY_SALT).digest('hex');
}

function isBcryptHash(storedHash: string): boolean {
  return storedHash.startsWith(BCRYPT_PREFIX);
}

/** Hash seguro (bcrypt). Use para novos cadastros e rehash no login. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export type PasswordVerifyResult = {
  ok: boolean;
  /** true se a senha bateu com hash legado SHA-256 — atualize no banco */
  needsRehash: boolean;
};

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<PasswordVerifyResult> {
  if (!storedHash || typeof storedHash !== 'string') {
    return { ok: false, needsRehash: false };
  }

  if (isBcryptHash(storedHash)) {
    const ok = await bcrypt.compare(password, storedHash);
    return { ok, needsRehash: false };
  }

  // Legado: SHA-256 + salt fixo (timing-safe)
  const inputHash = hashPasswordLegacy(password);
  try {
    const a = Buffer.from(inputHash, 'utf8');
    const b = Buffer.from(storedHash, 'utf8');
    if (a.length !== b.length) return { ok: false, needsRehash: false };
    const ok = crypto.timingSafeEqual(a, b);
    return { ok, needsRehash: ok };
  } catch {
    return { ok: false, needsRehash: false };
  }
}
