import crypto from 'crypto';
import { getEncryptionSecret } from '@/lib/envSecrets';

/**
 * Domu Tech - Sensitive Data Encryption Helper (AES-256-GCM)
 * Encrypts Meta Access Tokens and secret credentials before storing in PostgreSQL.
 */

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
}

export function encryptData(text: string): { encryptedText: string; iv: string } {
  const key = getKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const finalEncryptedText = `${encrypted}:${authTag}`;

  return {
    encryptedText: finalEncryptedText,
    iv: iv.toString('hex'),
  };
}

export function decryptData(encryptedText: string, ivHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');

  const [encrypted, authTagHex] = encryptedText.split(':');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
