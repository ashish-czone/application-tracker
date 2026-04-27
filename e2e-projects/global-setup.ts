import * as fs from 'node:fs';
import * as path from 'node:path';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3014';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@agency.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin1234';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'admin.json');

async function login(): Promise<Response> {
  return fetch(`${API_URL}/api/v1/auth/client/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
}

/**
 * Logs in once before the suite, persists tokens for spec fixtures to read.
 * Retries on 429 (auth has a 5-per-minute throttle that can trip during
 * back-to-back suite runs). Surfaces other failures upfront so "API down" /
 * "bad credentials" is obvious instead of failing every test.
 */
export default async function globalSetup(): Promise<void> {
  let res = await login();

  if (res.status === 429) {
    const waitMs = 65_000;
    console.log(`[e2e-projects globalSetup] 429 throttled; waiting ${waitMs / 1000}s then retrying.`);
    await new Promise((r) => setTimeout(r, waitMs));
    res = await login();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `e2e-projects globalSetup: login failed (${res.status}) for ${ADMIN_EMAIL}. ` +
        `Is the API at ${API_URL} running with ENABLE_TEST_HOOKS=true and seeded? Body: ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    userId: string;
  };

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify(
      { accessToken: data.accessToken, refreshToken: data.refreshToken, userId: data.userId },
      null,
      2,
    ),
  );
}
