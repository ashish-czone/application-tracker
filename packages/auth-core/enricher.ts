import type { JwtPayload } from './types';

/**
 * Extension point for enriching JWT claims at login/refresh time.
 *
 * Modules (e.g., TenancyModule) can register enrichers to add
 * extra claims to the JWT payload without modifying the auth package.
 *
 * Defined in auth-core (not auth) to avoid circular dependencies:
 * auth imports from tenancy/helpers, tenancy imports this from auth-core.
 */
export interface JwtClaimsEnricher {
  enrich(payload: JwtPayload): Promise<JwtPayload>;
}

export const JWT_CLAIMS_ENRICHERS = Symbol('JWT_CLAIMS_ENRICHERS');
