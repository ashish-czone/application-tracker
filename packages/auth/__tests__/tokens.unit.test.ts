import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateRandomToken,
  TokenExpiredError,
  InvalidTokenError,
} from '../tokens';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '../types';

const SECRET = 'test-secret-key';
const PAYLOAD: TokenPayload = {
  sub: 'user-123',
  email: 'test@example.com',
  entityName: 'user',
};

describe('tokens', () => {
  it('should roundtrip access token generation and verification', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    const decoded = verifyToken(token, SECRET);
    expect(decoded.sub).toBe(PAYLOAD.sub);
    expect(decoded.email).toBe(PAYLOAD.email);
    expect(decoded.entityName).toBe(PAYLOAD.entityName);
  });

  it('should throw TokenExpiredError for expired tokens', () => {
    const token = jwt.sign(PAYLOAD, SECRET, { expiresIn: '0s' });
    expect(() => verifyToken(token, SECRET)).toThrow(TokenExpiredError);
  });

  it('should throw InvalidTokenError for wrong secret', () => {
    const token = generateAccessToken(PAYLOAD, SECRET, '15m');
    expect(() => verifyToken(token, 'wrong-secret')).toThrow(InvalidTokenError);
  });

  it('should throw InvalidTokenError for malformed tokens', () => {
    expect(() => verifyToken('not.a.valid.token', SECRET)).toThrow(InvalidTokenError);
  });

  it('should include entityName in token payload', () => {
    const token = generateAccessToken(
      { ...PAYLOAD, entityName: 'admin' },
      SECRET,
      '15m',
    );
    const decoded = verifyToken(token, SECRET);
    expect(decoded.entityName).toBe('admin');
  });

  it('should generate 64-character hex random token', () => {
    const token = generateRandomToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate unique random tokens', () => {
    const token1 = generateRandomToken();
    const token2 = generateRandomToken();
    expect(token1).not.toBe(token2);
  });

  it('should include all claims in refresh token', () => {
    const token = generateRefreshToken(PAYLOAD, SECRET, '7d');
    const decoded = verifyToken(token, SECRET);
    expect(decoded.sub).toBe(PAYLOAD.sub);
    expect(decoded.email).toBe(PAYLOAD.email);
    expect(decoded.entityName).toBe(PAYLOAD.entityName);
  });
});
