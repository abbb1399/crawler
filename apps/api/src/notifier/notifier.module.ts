import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NOTIFIERS } from './notifier';
import { SlackNotifier } from './slack.notifier';

@Module({
  providers: [
    SlackNotifier,
    {
      provide: NOTIFIERS,
      useFactory: (slack: SlackNotifier) => [slack],
      inject: [SlackNotifier],
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotifierModule {}
