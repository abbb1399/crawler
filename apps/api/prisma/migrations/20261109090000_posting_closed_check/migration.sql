-- 상세 확인으로 조기마감을 잡는다. checkedAt: 마지막 확인 시각, closedAt: 원본이 마감이라고 답한 시각(재수집돼도 ACTIVE로 되돌리지 않음).
ALTER TABLE "JobPosting" ADD COLUMN "checkedAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3);
