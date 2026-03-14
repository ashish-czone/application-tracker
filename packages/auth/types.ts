export interface AuthenticableIdentity {
  id: string;
  email: string;
  passwordHash: string;
  refreshToken?: string | null;
}

export interface PasswordTokenRecord {
  id: string;
  identityId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface TokenPayload {
  sub: string;
  email: string;
  entityName: string;
}

export interface AuthRouteConfig {
  /** Enable/disable the built-in register route. Default: true. Disable when the entity module provides its own registration endpoint. */
  register?: boolean;
}

export interface AuthModuleConfig {
  entityName: string;
  routePrefix: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  jwtSecret: string;
  enrichIdentityProfile?: (identity: AuthenticableIdentity) => Promise<Record<string, unknown>>;
  onIdentityCreated?: (identity: AuthenticableIdentity) => Promise<void>;
  /** Configure which built-in routes are enabled. All enabled by default. */
  routes?: AuthRouteConfig;
}
