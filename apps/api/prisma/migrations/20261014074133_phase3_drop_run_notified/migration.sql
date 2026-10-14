-- CrawlRun.notified: notification is now a separate queue job, so a per-run count no longer makes sense.
ALTER TABLE "CrawlRun" DROP COLUMN "notified";
