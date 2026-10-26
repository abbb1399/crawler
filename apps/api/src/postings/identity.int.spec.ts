import { afterAll, describe, expect, it } from 'vitest';
import { makePrisma } from '../test/db';
import { fingerprint } from './identity';

/**
 * The SQL below is a copy of the backfill in prisma/migrations/*_loosen_title_fingerprint.
 * It must produce exactly what normalizeForFingerprint/fingerprint produce in JS, otherwise
 * rows backfilled by the migration and rows inserted by the app would never match as reposts.
 * When either side changes, change the other and this constant together.
 */
const SQL_FINGERPRINT = String.raw`
  SELECT md5(
    regexp_replace(lower(regexp_replace($1, '주식회사|㈜|\(주\)|\(유\)', '', 'g')), '[^0-9a-z가-힣]', '', 'g')
    || '|' ||
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower($2), '\([^)]*\)|\[[^]]*\]|【[^】]*】', '', 'g'),
          '[0-9]+\s*년\s*(이상|이하|차)?', '', 'g'),
        '신입|경력|채용|모집|급구|정규직|계약직|인턴|공고', '', 'g'),
      '[^0-9a-z가-힣]', '', 'g')
  ) AS fp`;

const SAMPLES: [company: string, title: string][] = [
  ['주식회사 모던랩스', 'Node.js 백엔드 개발자'],
  ['(주)모던랩스', '백엔드 개발자 (신입)'],
  ['㈜모던랩스', '[판교] 백엔드 개발자 경력 3년 이상'],
  ['(유)모던랩스', '【급구】 백엔드 개발자 5년차 정규직'],
  ['A사', '신입/경력 백엔드 개발자 모집 공고'],
  ['A사', '백엔드 개발자 (경력 3년↑) [계약직]'],
  ['A사', '3D 엔지니어'],
  ['Alpha & Beta Co., Ltd.', 'Senior Backend Engineer (Node.js) - Remote'],
  ['A사', '  공백   많은   제목  '],
  ['A사', '괄호 없는 ) 제목 ('],
];

const prisma = makePrisma();
afterAll(() => prisma.$disconnect());

describe('fingerprint: JS and migration SQL agree', () => {
  it.each(SAMPLES)('%s | %s', async (company, title) => {
    const [row] = await prisma.$queryRawUnsafe<{ fp: string }[]>(SQL_FINGERPRINT, company, title);
    expect(row.fp).toBe(fingerprint(company, title));
  });
});
