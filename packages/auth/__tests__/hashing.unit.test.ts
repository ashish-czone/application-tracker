import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken, verifyTokenHash } from '../hashing';

describe('hashing', () => {
  it('should produce a bcrypt hash format', async () => {
    const hash = await hashPassword('password123');
    expect(hash).toMatch(/^\$2[aby]?\$/);
  });

  it('should verify correct password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('correctPassword', hash);
    expect(result).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should produce unique salts for same input', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', async () => {
    const hash = await hashPassword('');
    expect(hash).toMatch(/^\$2[aby]?\$/);
    const result = await verifyPassword('', hash);
    expect(result).toBe(true);
  });
});

describe('hashToken / verifyTokenHash', () => {
  it('should produce a 64-char hex SHA-256 hash', () => {
    const hash = hashToken('some-token-value');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should verify matching token', () => {
    const hash = hashToken('my-refresh-token');
    expect(verifyTokenHash('my-refresh-token', hash)).toBe(true);
  });

  it('should reject different token', () => {
    const hash = hashToken('token-a');
    expect(verifyTokenHash('token-b', hash)).toBe(false);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashToken('token-1');
    const hash2 = hashToken('token-2');
    expect(hash1).not.toBe(hash2);
  });

  it('should distinguish inputs longer than 72 bytes', () => {
    // This is the exact scenario that broke bcrypt-based refresh token hashing
    const prefix = 'a'.repeat(72);
    const token1 = prefix + '-unique-suffix-1';
    const token2 = prefix + '-unique-suffix-2';
    const hash1 = hashToken(token1);
    expect(verifyTokenHash(token2, hash1)).toBe(false);
  });
});
