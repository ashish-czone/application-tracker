import { createAuthenticatedApi } from '@packages/auth-ui/createAuthenticatedApi';

export const api = createAuthenticatedApi(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1');
