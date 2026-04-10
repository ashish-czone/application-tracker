export interface OAuthProviderConfig {
  /** Provider identifier, e.g., 'google', 'github' */
  provider: string;
  clientId: string;
  clientSecret: string;
  /** Override default scopes for this provider */
  scopes?: string[];
}

/** Built-in providers that the OAuth module supports */
export const SUPPORTED_PROVIDERS = ['google'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Get the runtime config for a provider from AppConfigService (cached, no DB hit).
 * Returns null if provider is not configured (clientId or clientSecret empty).
 */
export function getOAuthProviderConfig(appConfig: { get<T>(module: string, key: string, defaultValue?: T): T }, providerName: string): OAuthProviderConfig | null {
  const clientId = appConfig.get<string>('oauth', `${providerName}.clientId`, '');
  const clientSecret = appConfig.get<string>('oauth', `${providerName}.clientSecret`, '');

  if (!clientId || !clientSecret) return null;

  return { provider: providerName, clientId, clientSecret };
}
