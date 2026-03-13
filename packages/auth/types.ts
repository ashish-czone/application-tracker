export interface AuthenticableUser {
  id: string;
  email: string;
  passwordHash: string;
  refreshToken?: string | null;
  timezone?: string | null;
}

export interface PasswordTokenRecord {
  id: string;
  userId: string;
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
  getUserDelegate: () => AuthUserDelegate;
  getPasswordTokenDelegate: () => AuthPasswordTokenDelegate;
}

export interface AuthUserDelegate {
  findUnique(args: {
    where: { id?: string; email?: string };
  }): Promise<AuthenticableUser | null>;
  update(args: {
    where: { id: string };
    data: Partial<AuthenticableUser>;
  }): Promise<AuthenticableUser>;
  create(args: {
    data: Omit<AuthenticableUser, 'id'>;
  }): Promise<AuthenticableUser>;
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
