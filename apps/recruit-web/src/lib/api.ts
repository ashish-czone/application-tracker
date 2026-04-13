import { createAuthenticatedApi } from '@packages/auth-ui/createAuthenticatedApi';

export const api = createAuthenticatedApi(import.meta.env.VITE_API_URL || '/api/v1');
