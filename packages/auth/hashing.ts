import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * SHA-256 hash for high-entropy tokens (refresh tokens, API keys).
 * Unlike bcrypt, SHA-256 processes the full input without truncation.
 * Safe for tokens with sufficient entropy (>= 128 bits).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(token: string, hash: string): boolean {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}
