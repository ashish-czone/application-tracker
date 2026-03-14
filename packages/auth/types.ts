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

export interface AuthModuleConfig {
  entityName: string;
  routePrefix: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  jwtSecret: string;
  getIdentityDelegate: () => AuthIdentityDelegate;
  getPasswordTokenDelegate: () => AuthPasswordTokenDelegate;
  enrichIdentityProfile?: (identity: AuthenticableIdentity) => Promise<Record<string, unknown>>;
  onIdentityCreated?: (identity: AuthenticableIdentity) => Promise<void>;
}

export interface AuthIdentityDelegate {
  findUnique(args: {
    where: { id?: string; email?: string };
  }): Promise<AuthenticableIdentity | null>;
  update(args: {
    where: { id: string };
    data: Partial<AuthenticableIdentity>;
  }): Promise<AuthenticableIdentity>;
  create(args: {
    data: Omit<AuthenticableIdentity, 'id'>;
  }): Promise<AuthenticableIdentity>;
}

export interface AuthPasswordTokenDelegate {
  findUnique(args: {
    where: { token?: string; id?: string };
  }): Promise<PasswordTokenRecord | null>;
  create(args: {
    data: Omit<PasswordTokenRecord, 'id' | 'usedAt'>;
  }): Promise<PasswordTokenRecord>;
  update(args: {
    where: { id: string };
    data: Partial<PasswordTokenRecord>;
  }): Promise<PasswordTokenRecord>;
}
