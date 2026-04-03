export interface JwtPayload {
  userId: string;
  [key: string]: unknown;
}

export interface AuthModuleConfig {
  jwtSecret: string;
  accessTokenExpiresIn?: string;
  refreshTokenExpiresIn?: string;
  resetTokenExpiresIn?: string;
  defaultAdminEmail?: string;
  defaultAdminPassword?: string;
}

export interface Credential {
  id: string;
  userId: string;
  provider: string;
  identifier: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  id: string;
  userId: string;
  type: string;
  expiresAt: Date;
  revokedAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
}

export const AUTH_MODULE_CONFIG = Symbol('AUTH_MODULE_CONFIG');

export const AUTH_TOKEN_TYPES = {
  REFRESH: 'refresh',
  PASSWORD_RESET: 'password_reset',
} as const;
