import crypto from 'crypto';

/**
 * DOMU Tech - Sensitive Data Encryption Helper (AES-256-GCM)
 * Encrypts Meta Access Tokens and secret credentials before storing in PostgreSQL.
 */

const ALGORITHM = 'aes-256-gcm';

// Fallback secret key for local development
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY || 'domu_tech_master_encryption_key_32bytes_secret!';

export function encryptData(text: string): { encryptedText: string; iv: string } {
  // Ensure key is exactly 32 bytes
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  
  // Combine encrypted data with authTag
  const finalEncryptedText = `${encrypted}:${authTag}`;

  return {
    encryptedText: finalEncryptedText,
    iv: iv.toString('hex')
  };
}

export function decryptData(encryptedText: string, ivHex: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = Buffer.from(ivHex, 'hex');

  const [encrypted, authTagHex] = encryptedText.split(':');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
