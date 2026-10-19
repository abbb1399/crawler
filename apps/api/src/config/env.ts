import { z } from 'zod';

/**
 * Validated environment. Loaded once by ConfigModule.validate (see app.module.ts).
 * Add new keys here as phases introduce them; unknown keys are ignored.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** CORS origin for apps/web. */
  WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
  /** all = api + workers + cron (default). See config/role.ts. */
  ROLE: z.enum(['all', 'api', 'worker']).default('all'),

  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  /** Drop waiting/delayed jobs at startup. Useful after a messy dev restart. */
  QUEUE_DRAIN_ON_BOOT: z.stringbool().default(false),

  /** Max result pages per keyword for Wanted (20 items/page). */
  WANTED_MAX_PAGES: z.coerce.number().int().min(1).max(20).default(3),

  /** Max result pages per keyword for Saramin (40 items/page). */
  SARAMIN_MAX_PAGES: z.coerce.number().int().min(1).max(10).default(2),
  /** Playwright: headless unless explicitly false (headed is the main debugging tool). */
  PW_HEADLESS: z.stringbool().default(true),
  /** Persistent browser profile dir (cookies survive restarts). Relative to apps/api. */
  PW_PROFILE_DIR: z.string().default('.data/pw-profile'),
  /** Where failure screenshots go. */
  DEBUG_DIR: z.string().default('storage/debug'),

  /** Nightly maintenance (expiry pass). */
  MAINTENANCE_CRON: z.string().min(9).default('15 3 * * *'),
  /** ACTIVE postings not seen by any crawl for this many days are marked EXPIRED. */
  STALE_DAYS: z.coerce.number().int().min(1).default(14),
  /** A new posting whose fingerprint was seen within this window counts as a repost. */
  REPOST_WINDOW_DAYS: z.coerce.number().int().min(1).default(45),
  /** Announce reposts too (default: suppress). */
  NOTIFY_REPOSTS: z.stringbool().default(false),
  /** Same alert key is not re-sent within this many minutes. */
  ALERT_MIN_INTERVAL_MIN: z.coerce.number().int().min(1).default(360),

  /** Cron expression for enqueueing crawls of all enabled profiles. */
  CRAWL_CRON: z.string().min(9).default('*/30 * * * *'),
  /** Also enqueue one full crawl ~2s after startup. Handy in dev. */
  CRAWL_ON_BOOT: z.stringbool().default(false),

  /** Slack Incoming Webhook URL. Unset = Slack channel disabled. */
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  /** Cap on postings announced per channel per run (10 per Slack message). */
  NOTIFY_MAX_PER_RUN: z.coerce.number().int().min(1).max(500).default(50),
  /** Only postings first seen within this window are eligible for a NEW notification. */
  NOTIFY_LOOKBACK_HOURS: z.coerce.number().int().min(1).default(24),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return result.data;
}
