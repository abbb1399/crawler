-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('WANTED', 'JOBKOREA');

-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CrawlRunStatus" AS ENUM ('RUNNING', 'OK', 'FAILED');

-- CreateEnum
CREATE TYPE "NotifyChannel" AS ENUM ('SLACK', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotifyKind" AS ENUM ('NEW', 'REPOST');

-- CreateTable
CREATE TABLE "SearchProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "sources" "JobSource"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" SERIAL NOT NULL,
    "source" "JobSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "url" TEXT NOT NULL,
    "dueDate" DATE,
    "contentHash" TEXT NOT NULL,
    "status" "PostingStatus" NOT NULL DEFAULT 'ACTIVE',
    "raw" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" SERIAL NOT NULL,
    "source" "JobSource" NOT NULL,
    "profileId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "CrawlRunStatus" NOT NULL DEFAULT 'RUNNING',
    "found" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "postingId" INTEGER NOT NULL,
    "channel" "NotifyChannel" NOT NULL,
    "kind" "NotifyKind" NOT NULL DEFAULT 'NEW',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchProfile_name_key" ON "SearchProfile"("name");

-- CreateIndex
CREATE INDEX "JobPosting_status_lastSeenAt_idx" ON "JobPosting"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "JobPosting_firstSeenAt_idx" ON "JobPosting"("firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_source_externalId_key" ON "JobPosting"("source", "externalId");

-- CreateIndex
CREATE INDEX "CrawlRun_source_startedAt_idx" ON "CrawlRun"("source", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_postingId_channel_kind_key" ON "NotificationLog"("postingId", "channel", "kind");

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SearchProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
