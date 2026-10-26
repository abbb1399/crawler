import { defineConfig } from 'vitest/config';

// unit:        src/**/*.spec.ts       — pure functions, adapters with stubbed fetch, jsdom fixtures
// integration: src/**/*.int.spec.ts   — real Postgres (TEST_DATABASE_URL, see src/test/global-setup.ts)
export default defineConfig({
  test: {
    // Due-date parsing and the expiry pass use local time; production runs in Asia/Seoul too.
    env: { TZ: 'Asia/Seoul' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.int.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.spec.ts'],
          globalSetup: ['src/test/global-setup.ts'],
          // One shared database: files must not interleave their TRUNCATEs.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
