import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import type { TokenPayload } from './types';

export function generateAccessToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function generateRefreshToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: string,
): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    secret,
    { expiresIn } as SignOptions,
  );
}

export function verifyToken(token: string, secret: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError('Invalid token');
    }
    throw error;
  }
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}
