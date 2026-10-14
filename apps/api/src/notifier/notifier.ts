import type { JobSource, NotifyChannel } from '../generated/prisma/enums';

/** The subset of JobPosting a notifier needs to render a message. */
export interface NotifiablePosting {
  id: number;
  source: JobSource;
  title: string;
  company: string;
  location: string | null;
  url: string;
  dueDate: Date | null;
}

/**
 * One implementation per channel. `send` receives a small batch (≤10) and must
 * either deliver all of them or throw; partial success is treated as failure.
 */
export interface Notifier {
  readonly channel: NotifyChannel;
  /** False when the channel is not configured (e.g. missing webhook URL). */
  readonly enabled: boolean;
  send(postings: NotifiablePosting[]): Promise<void>;
}

export const NOTIFIERS = Symbol('NOTIFIERS');
