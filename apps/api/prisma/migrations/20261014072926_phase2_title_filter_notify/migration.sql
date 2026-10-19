-- AlterTable
ALTER TABLE "CrawlRun" ADD COLUMN     "fetched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notified" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SearchProfile" ADD COLUMN     "excludeTitle" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "includeTitle" TEXT[] DEFAULT ARRAY[]::TEXT[];
