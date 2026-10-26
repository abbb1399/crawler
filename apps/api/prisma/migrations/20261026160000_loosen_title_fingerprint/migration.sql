-- Looser repost fingerprint: the title part now ignores bracketed qualifiers and hiring boilerplate
-- ("백엔드 개발자 (신입)", "[판교] 백엔드 개발자 경력 3년 이상" → "백엔드개발자").
-- Backfills every row with the same rules as postings/identity.ts normalizeForFingerprint;
-- identity.int.spec.ts asserts the JS and this SQL agree. repostOfId is left as previously judged.
UPDATE "JobPosting" SET "fingerprint" = md5(
  regexp_replace(lower(regexp_replace("company", '주식회사|㈜|\(주\)|\(유\)', '', 'g')), '[^0-9a-z가-힣]', '', 'g')
  || '|' ||
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower("title"), '\([^)]*\)|\[[^]]*\]|【[^】]*】', '', 'g'),
        '[0-9]+\s*년\s*(이상|이하|차)?', '', 'g'),
      '신입|경력|채용|모집|급구|정규직|계약직|인턴|공고', '', 'g'),
    '[^0-9a-z가-힣]', '', 'g')
);
