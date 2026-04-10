export interface ServiceAuthConfig {
  /** Unique identifier for this service (used as `iss` claim in outgoing JWTs) */
  serviceId: string;

  /** PEM-encoded private key for signing outgoing JWTs */
  privateKey: string;

  /** Map of trusted service IDs to their PEM-encoded public keys */
  trustedServices: Record<string, string>;

  /** Signing algorithm — default 'RS256' */
  algorithm?: 'RS256' | 'ES256';

  /** Token time-to-live in seconds — default 300 (5 minutes) */
  tokenTtl?: number;
}

export interface ServiceAuthModuleAsyncOptions {
  useFactory: (...args: any[]) => ServiceAuthConfig | Promise<ServiceAuthConfig>;
  inject?: any[];
}

export interface ServiceTokenPayload {
  iss: string;
  aud: string;
  scopes?: string[];
  iat: number;
  exp: number;
}

export const SERVICE_AUTH_CONFIG = Symbol('SERVICE_AUTH_CONFIG');
