-- "읽음"(seen)을 "숨김"(hidden)으로 전환. 기존에 읽음 처리된 행은 그대로 숨김이 된다.
ALTER TABLE "JobPosting" RENAME COLUMN "seen" TO "hidden";
