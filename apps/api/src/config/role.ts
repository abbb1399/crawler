/**
 * Process role. Read straight from process.env because module decorators evaluate
 * before ConfigModule is available; ConfigModule.forRoot() has already loaded .env
 * by the time AppModule's imports array is evaluated, so this is safe there.
 *
 *   all    - HTTP API + queue workers + cron scheduler (default, single process)
 *   api    - HTTP API only (enqueues, never processes)
 *   worker - queue workers + cron scheduler, no HTTP routes of interest
 */
export type Role = 'all' | 'api' | 'worker';

export function currentRole(): Role {
  const r = process.env['ROLE'];
  return r === 'api' || r === 'worker' ? r : 'all';
}

export const runsWorkers = () => currentRole() !== 'api';
