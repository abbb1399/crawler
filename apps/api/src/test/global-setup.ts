import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from './env';

/**
 * Runs once before the integration project: creates the test database if it is missing and
 * applies all migrations to it. Locally this is the docker-compose Postgres; in CI the
 * `services.postgres` container. Refuses anything whose name does not end in `_test`.
 */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`refusing to run integration tests against "${dbName}" (database name must end with _test)`);
  }

  const admin = new Client({ connectionString: new URL('/postgres', url).toString() });
  await admin.connect();
  try {
    const r = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (r.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  // cwd is apps/api when run via `pnpm --filter api test:int`; prisma.config.ts resolves the schema from there.
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
