import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { Env } from '../config/env';
import { USER_AGENT } from './scrape';

/**
 * Playwright lifecycle. One persistent context (cookies survive restarts) is opened
 * per `withContext` call and closed right after, never kept for the process lifetime:
 * `nest start --watch` on Windows does not deliver SIGINT reliably, and a long-lived
 * browser would leave orphaned chrome.exe processes behind on every restart.
 *
 * Headless by default; PW_HEADLESS=false opens a visible window for debugging.
 */
@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private readonly headless: boolean;
  private readonly profileDir: string;
  private readonly debugDir: string;
  private current: BrowserContext | null = null;

  constructor(config: ConfigService<Env, true>) {
    this.headless = config.get('PW_HEADLESS', { infer: true });
    this.profileDir = resolve(config.get('PW_PROFILE_DIR', { infer: true }));
    this.debugDir = resolve(config.get('DEBUG_DIR', { infer: true }));
  }

  /** Runs `fn` with a fresh persistent context, always closing it afterwards. */
  async withContext<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
    if (this.current) {
      throw new Error('BrowserService is single-tenant; a context is already open');
    }
    await mkdir(this.profileDir, { recursive: true });
    const ctx = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      userAgent: USER_AGENT,
      locale: 'ko-KR',
      viewport: { width: 1280, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    this.current = ctx;
    try {
      return await fn(ctx);
    } finally {
      this.current = null;
      await ctx.close().catch((e) => this.logger.warn(`context close failed: ${e}`));
    }
  }

  /** Saves a screenshot for post-mortem; returns the path or null if that failed too. */
  async snapshot(page: Page, label: string): Promise<string | null> {
    try {
      await mkdir(this.debugDir, { recursive: true });
      const file = resolve(this.debugDir, `${label}-${Date.now()}.png`);
      await page.screenshot({ path: file, fullPage: false });
      this.logger.warn(`screenshot saved: ${file}`);
      return file;
    } catch (e) {
      this.logger.warn(`screenshot failed: ${e}`);
      return null;
    }
  }

  async onModuleDestroy() {
    if (this.current) {
      await this.current.close().catch(() => undefined);
      this.current = null;
    }
  }
}
