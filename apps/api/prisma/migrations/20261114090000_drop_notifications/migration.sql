-- 슬랙 알림 제거: 발송 기록 테이블과 채널/종류 enum을 지운다.
DROP TABLE "NotificationLog";
DROP TYPE "NotifyChannel";
DROP TYPE "NotifyKind";
