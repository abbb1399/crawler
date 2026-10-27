import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const minimal = { DATABASE_URL: 'postgresql://trawler:trawler@localhost:5432/trawler' };

describe('validateEnv', () => {
  it('fills defaults when only DATABASE_URL is given', () => {
    const env = validateEnv(minimal);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ROLE: 'all',
      CRAWL_CRON: '*/30 * * * *',
      CRAWL_ON_BOOT: false,
      STALE_DAYS: 14,
      REPOST_WINDOW_DAYS: 45,
      NOTIFY_REPOSTS: false,
      NOTIFY_MAX_PER_RUN: 50,
      PW_HEADLESS: true,
    });
    expect(env.SLACK_WEBHOOK_URL).toBeUndefined();
  });

  it('defaults LOG_LEVEL by NODE_ENV and accepts an override', () => {
    expect(validateEnv(minimal).LOG_LEVEL).toBe('debug');
    expect(validateEnv({ ...minimal, NODE_ENV: 'production' }).LOG_LEVEL).toBe('info');
    expect(validateEnv({ ...minimal, NODE_ENV: 'production', LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn');
    expect(() => validateEnv({ ...minimal, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('coerces numbers and booleans from strings', () => {
    const env = validateEnv({ ...minimal, PORT: '4000', PW_HEADLESS: 'false', CRAWL_ON_BOOT: 'true', STALE_DAYS: '7' });
    expect(env).toMatchObject({ PORT: 4000, PW_HEADLESS: false, CRAWL_ON_BOOT: true, STALE_DAYS: 7 });
  });

  it('lists every offending key in the error', () => {
    let message = '';
    try {
      validateEnv({ ROLE: 'nope' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^Invalid environment:/);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('ROLE');
  });

  it('rejects a malformed Slack webhook URL rather than silently disabling Slack', () => {
    expect(() => validateEnv({ ...minimal, SLACK_WEBHOOK_URL: 'hooks.slack.com/xxx' })).toThrow(/SLACK_WEBHOOK_URL/);
  });
});
