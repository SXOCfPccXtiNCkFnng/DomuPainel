import crypto from 'crypto';

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

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'domu_tech_salt_2026').digest('hex');
}
