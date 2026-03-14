export interface ApiClientConfig {
  baseUrl: string;
  /** Path for token refresh (e.g., '/users/auth/refresh'). Defaults to '/users/auth/refresh'. */
  refreshPath?: string;
  onSessionExpired: () => void;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
