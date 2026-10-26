/** Integration tests run against their own database; never the dev/prod one. */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://trawler:trawler@localhost:5432/trawler_test';
