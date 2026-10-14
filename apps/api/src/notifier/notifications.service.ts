import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import type { NotifyChannel } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFIERS, type NotifiablePosting, type Notifier } from './notifier';

const BATCH_SIZE = 10;

/**
 * Finds postings that have not been announced on each enabled channel and sends them.
 * Idempotent: NotificationLog(postingId, channel, kind) is unique, and only rows with
 * ok=true count as delivered, so a crash or a failed webhook call is retried next time.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly maxPerRun: number;
  private readonly lookbackHours: number;

  constructor(
    @Inject(NOTIFIERS) private readonly notifiers: Notifier[],
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.maxPerRun = config.get('NOTIFY_MAX_PER_RUN', { infer: true });
    this.lookbackHours = config.get('NOTIFY_LOOKBACK_HOURS', { infer: true });
  }

  enabledChannels(): NotifyChannel[] {
    return this.notifiers.filter((n) => n.enabled).map((n) => n.channel);
  }

  /** Returns the number of postings delivered across all channels. */
  async dispatchPending(): Promise<number> {
    let delivered = 0;
    for (const notifier of this.notifiers) {
      if (!notifier.enabled) continue;
      delivered += await this.dispatchForChannel(notifier);
    }
    return delivered;
  }

  private async dispatchForChannel(notifier: Notifier): Promise<number> {
    const since = new Date(Date.now() - this.lookbackHours * 3_600_000);
    const pending = await this.prisma.jobPosting.findMany({
      where: {
        status: 'ACTIVE',
        firstSeenAt: { gte: since },
        notifications: { none: { channel: notifier.channel, kind: 'NEW', ok: true } },
      },
      orderBy: { firstSeenAt: 'asc' },
      take: this.maxPerRun,
      select: {
        id: true,
        source: true,
        title: true,
        company: true,
        location: true,
        url: true,
        dueDate: true,
      },
    });
    if (pending.length === 0) return 0;

    let delivered = 0;
    for (const batch of chunk(pending, BATCH_SIZE)) {
      try {
        await notifier.send(batch);
        await this.markSent(batch, notifier.channel, true);
        delivered += batch.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${notifier.channel}: ${message}`);
        await this.markSent(batch, notifier.channel, false, message);
        break; // Channel is unhealthy; leave the rest for the next run.
      }
    }
    this.logger.log(`${notifier.channel}: delivered ${delivered}/${pending.length} pending`);
    return delivered;
  }

  private async markSent(
    batch: NotifiablePosting[],
    channel: NotifyChannel,
    ok: boolean,
    error?: string,
  ) {
    const sentAt = new Date();
    await this.prisma.$transaction(
      batch.map((p) =>
        this.prisma.notificationLog.upsert({
          where: { postingId_channel_kind: { postingId: p.id, channel, kind: 'NEW' } },
          create: { postingId: p.id, channel, kind: 'NEW', ok, error, sentAt },
          update: { ok, error: error ?? null, sentAt },
        }),
      ),
    );
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
