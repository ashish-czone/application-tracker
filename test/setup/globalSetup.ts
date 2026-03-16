import { execSync } from 'child_process';
import path from 'path';

export default function globalSetup() {
  const databaseDir = path.resolve(__dirname, '../../packages/database');

  try {
    execSync('npx drizzle-kit migrate', {
      cwd: databaseDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter',
      },
    });
  } catch {
    // If DB is unavailable, skip — allows pure unit tests to run without DB
    console.warn('Global setup: database migration skipped (DB may be unavailable)');
  }
}
