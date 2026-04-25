import * as fs from 'node:fs';
import * as path from 'node:path';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3012';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@compliance.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin1234';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'admin.json');

/**
 * Logs in once before the suite, persists tokens for spec fixtures to read.
 * Surfacing failure here (instead of in each test) makes "API down" / "bad
 * credentials" obvious.
 */
export default async function globalSetup(): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/client/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `e2e-compliance globalSetup: login failed (${res.status}) for ${ADMIN_EMAIL}. ` +
        `Is the API at ${API_URL} running and seeded? Body: ${body.slice(0, 300)}`,
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
