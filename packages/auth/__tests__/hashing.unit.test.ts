import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../hashing';

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
