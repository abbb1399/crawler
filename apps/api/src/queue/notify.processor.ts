import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifier/notifications.service';
import { NOTIFY_QUEUE, type NotifyJobData } from './queue.constants';

/**
 * Delivers everything pending on every enabled channel. NotificationLog already
 * makes this idempotent; throwing on partial failure lets BullMQ retry with backoff.
 */
@Processor(NOTIFY_QUEUE, { concurrency: 1 })
export class NotifyProcessor extends WorkerHost {
  private readonly logger = new Logger(NotifyProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotifyJobData>) {
    const result = await this.notifications.dispatchPending();
    this.logger.log(
      { jobId: job.id, runId: job.data.runId ?? null, delivered: result.delivered, failed: result.failed },
      'notify job done',
    );
    if (result.failed > 0) {
      throw new Error(`${result.failed} notification(s) failed; will retry`);
    }
    return result;
  }
}
