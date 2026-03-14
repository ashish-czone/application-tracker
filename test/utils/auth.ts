import { generateAccessToken } from '@packages/auth';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-user-secret';

export function tokenFor(identity: { id: string; email: string }): string {
  return generateAccessToken(
    { sub: identity.id, email: identity.email, entityName: 'identity' },
    TEST_JWT_SECRET,
    '15m',
  );
}

export function expiredTokenFor(identity: { id: string; email: string }): string {
  return jwt.sign(
    { sub: identity.id, email: identity.email, entityName: 'identity' },
    TEST_JWT_SECRET,
    { expiresIn: '0s' },
  );
}
