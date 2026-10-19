import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SOURCE_LABEL } from '@trawler/shared';
import type { Env } from '../config/env';
import type { NotifiablePosting, Notifier } from './notifier';

/**
 * Slack Incoming Webhook. One message per batch, rendered with Block Kit:
 * a header line plus one section per posting.
 */
@Injectable()
export class SlackNotifier implements Notifier {
  readonly channel = 'SLACK' as const;
  private readonly logger = new Logger(SlackNotifier.name);
  private readonly webhookUrl: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.webhookUrl = config.get('SLACK_WEBHOOK_URL', { infer: true });
    if (!this.webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not set; Slack notifications are disabled');
    }
  }

  get enabled() {
    return Boolean(this.webhookUrl);
  }

  async send(postings: NotifiablePosting[]): Promise<void> {
    if (postings.length === 0) return;
    await this.post(buildMessage(postings));
  }

  async sendText(text: string): Promise<void> {
    await this.post({ text });
  }

  private async post(payload: unknown): Promise<void> {
    if (!this.webhookUrl) throw new Error('Slack notifier is disabled');
    const res = await globalThis.fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Slack webhook failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}

export function buildMessage(postings: NotifiablePosting[]) {
  const sources = [...new Set(postings.map((p) => SOURCE_LABEL[p.source as keyof typeof SOURCE_LABEL] ?? p.source))].join(', ');
  const headline = `새 공고 ${postings.length}건 · ${sources}`;

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: headline, emoji: true } },
  ];
  for (const p of postings) {
    const meta = [p.company, p.location, p.dueDate ? `~${formatDate(p.dueDate)}` : '상시'].filter(Boolean);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${p.url}|${escapeMrkdwn(p.title)}>*\n${escapeMrkdwn(meta.join(' · '))}`,
      },
    });
  }

  return {
    // Fallback for notifications/previews where blocks are not rendered.
    text: `${headline}\n${postings.map((p) => `• ${p.company} — ${p.title}`).join('\n')}`,
    blocks,
  };
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function escapeMrkdwn(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
