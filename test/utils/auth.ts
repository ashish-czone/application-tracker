import { generateAccessToken } from '@packages/auth';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-user-secret';

export function tokenFor(user: { id: string; email: string }): string {
  return generateAccessToken(
    { sub: user.id, email: user.email, entityName: 'user' },
    TEST_JWT_SECRET,
    '15m',
  );
}

export function expiredTokenFor(user: { id: string; email: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, entityName: 'user' },
    TEST_JWT_SECRET,
    { expiresIn: '0s' },
  );
}
