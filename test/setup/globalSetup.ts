import { execSync } from 'child_process';
import path from 'path';

export default function globalSetup() {
  const databaseDir = path.resolve(__dirname, '../../packages/database');

  // Collect schemas and run migrations
  execSync('node scripts/collect-schemas.js && npx prisma migrate deploy', {
    cwd: databaseDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter',
    },
  });
}
