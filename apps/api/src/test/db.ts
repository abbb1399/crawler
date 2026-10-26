import type { ConfigService } from '@nestjs/config';
import type { RawPosting } from '@trawler/shared';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { toRow } from '../postings/identity';
import { PrismaService } from '../prisma/prisma.service';
import { TEST_DATABASE_URL } from './env';

/**
 * Services read config only through `config.get(key, { infer: true })` in their constructors,
 * so a plain lookup object stands in for Nest's ConfigService and no DI container is needed.
 */
export function stubConfig(values: Partial<Env> = {}): ConfigService<Env, true> {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

export function makePrisma(): PrismaService {
  return new PrismaService(stubConfig({ DATABASE_URL: TEST_DATABASE_URL }));
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "NotificationLog", "CrawlRun", "JobPosting", "SearchProfile" RESTART IDENTITY CASCADE',
  );
}

export function rawPosting(overrides: Partial<RawPosting> = {}): RawPosting {
  return {
    source: 'WANTED',
    externalId: 'w1',
    title: 'Node.js 백엔드 개발자',
    company: 'A사',
    location: '서울 강남구',
    url: 'https://example.com/w1',
    dueDate: null,
    raw: {},
    ...overrides,
  };
}

/** Inserts one JobPosting straight into the DB (bypassing upsertMany) for arranging fixtures. */
export function seedPosting(
  prisma: PrismaService,
  raw: RawPosting,
  overrides: Partial<Prisma.JobPostingUncheckedCreateInput> = {},
) {
  return prisma.jobPosting.create({ data: { ...toRow(raw), lastSeenAt: new Date(), ...overrides } });
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
