export interface OAuthUserProfile {
  /** Provider-specific user ID (e.g., Google's 'sub' claim) */
  providerUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface OAuthProvider {
  /** Provider identifier, e.g., 'google', 'github' */
  readonly provider: string;
  /** Default OAuth scopes for this provider */
  readonly defaultScopes: string[];

  /** Build the full authorization URL for the OAuth redirect */
  getAuthorizationUrl(clientId: string, redirectUri: string, state: string, scopes?: string[]): string;

  /** Exchange an authorization code for an access token */
  exchangeCode(code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<{ accessToken: string }>;

  /** Fetch the user's profile from the provider using the access token */
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;
}
