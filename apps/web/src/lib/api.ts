import { createAuthenticatedApi } from '@packages/platform-ui/auth/createAuthenticatedApi';

export const api = createAuthenticatedApi(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1');
