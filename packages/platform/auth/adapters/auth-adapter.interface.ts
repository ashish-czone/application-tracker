export interface AuthAdapterResult {
  /** Set if user already exists in the system */
  userId?: string;
  /** Always present — the user's email address */
  email: string;
  /** For new user creation (optional — defaults derived from email if missing) */
  firstName?: string;
  lastName?: string;
  /** Credential provider key (e.g., 'password', 'google') */
  provider: string;
  /** Credential identifier (e.g., email for password, provider user ID for OAuth) */
  providerIdentifier: string;
  /** No user found — orchestrator should create one */
  isNewUser: boolean;
  /** No credential found — orchestrator should create one */
  isNewCredential: boolean;
}

export interface AuthAdapter {
  /** Unique provider identifier, e.g., 'password', 'google', 'github' */
  readonly provider: string;

  /**
   * Authenticate using provider-specific credentials.
   * Returns identity information the orchestrator uses to generate tokens.
   * Throws UnauthorizedException on authentication failure.
   */
  authenticate(credentials: Record<string, unknown>): Promise<AuthAdapterResult>;
}
