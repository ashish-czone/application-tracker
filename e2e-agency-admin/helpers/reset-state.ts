import { apiClient } from './api-client';

/**
 * Resets the agency API's database to a known minimal state:
 * truncates every data table and reruns the system seeds + the
 * e2e-admin demo seed. The e2e-admin's user id is pinned so the
 * JWT token written by global-setup.ts survives the reset.
 *
 * Wire into a spec via `test.beforeAll(resetState)`. For specs whose
 * tests mutually interfere, call it from `test.beforeEach` instead.
 *
 * Requires the API to be running with `ENABLE_TEST_HOOKS=true`.
 */
export async function resetState(): Promise<void> {
  await apiClient.post('/admin/test/reset');
}
