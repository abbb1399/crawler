-- Repost detection: fingerprint = md5(normalized "company|title"). Backfilled for existing rows
-- with the same normalization the app uses (see postings.service.ts normalizeForFingerprint).
ALTER TABLE "JobPosting" ADD COLUMN "fingerprint" TEXT, ADD COLUMN "repostOfId" INTEGER;

UPDATE "JobPosting" SET "fingerprint" = md5(
  regexp_replace(lower(regexp_replace("company", '주식회사|㈜|\(주\)|\(유\)', '', 'g')), '[^0-9a-z가-힣]', '', 'g')
  || '|' ||
  regexp_replace(lower("title"), '[^0-9a-z가-힣]', '', 'g')
);

ALTER TABLE "JobPosting" ALTER COLUMN "fingerprint" SET NOT NULL;
CREATE INDEX "JobPosting_fingerprint_idx" ON "JobPosting"("fingerprint");
CREATE INDEX "JobPosting_dueDate_idx" ON "JobPosting"("dueDate");
