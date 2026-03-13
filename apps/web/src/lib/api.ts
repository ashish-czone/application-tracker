import { createApiClient } from '@packages/api-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

let sessionExpiredCallback: (() => void) | null = null;

export function setSessionExpiredCallback(callback: () => void) {
  sessionExpiredCallback = callback;
}

export const api = createApiClient({
  baseUrl: API_URL,
  onSessionExpired: () => {
    sessionExpiredCallback?.();
  },
});
