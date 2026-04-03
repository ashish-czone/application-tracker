export interface OAuthProviderConfig {
  /** Provider identifier, e.g., 'google', 'github' */
  provider: string;
  clientId: string;
  clientSecret: string;
  /** Override default scopes for this provider */
  scopes?: string[];
}

export interface OAuthModuleConfig {
  providers: OAuthProviderConfig[];
}

export const OAUTH_MODULE_CONFIG = Symbol('OAUTH_MODULE_CONFIG');
