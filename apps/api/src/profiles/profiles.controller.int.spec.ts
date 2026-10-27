import type { SearchProfileInput } from '@trawler/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { classify } from '../common/all-exceptions.filter';
import { makePrisma, truncateAll } from '../test/db';
import { ProfilesController } from './profiles.controller';

const prisma = makePrisma();
const ctl = new ProfilesController(prisma);

const input = (name: string): SearchProfileInput => ({
  name,
  keywords: ['node'],
  includeTitle: [],
  excludeTitle: [],
  sources: ['WANTED'],
  regions: [],
  enabled: true,
});

/** The HTTP status the global exception filter would send for this call's error. */
async function statusOf(p: Promise<unknown>): Promise<number> {
  const err = await p.then(() => null, (e: unknown) => e);
  if (err === null) throw new Error('expected the call to fail');
  return classify(err).status;
}

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

// The controller relies on the DB (unique name) and the filter (P2002 → 409, P2025 → 404) instead of
// checking first; these prove the real Prisma errors take that path.
describe('ProfilesController', () => {
  it('rejects a duplicate name with 409, on create and on rename', async () => {
    await ctl.create(input('backend'));
    const other = await ctl.create(input('frontend'));
    expect(await statusOf(ctl.create(input('backend')))).toBe(409);
    expect(await statusOf(ctl.update(other.id, { name: 'backend' }))).toBe(409);
    const err = await ctl.create(input('backend')).then(() => null, (e: unknown) => e);
    expect(classify(err).message).toBe('이미 존재합니다: name');
  });

  it('answers 404 for a missing profile on get, update and delete', async () => {
    expect(await statusOf(ctl.get(999))).toBe(404);
    expect(await statusOf(ctl.update(999, { enabled: false }))).toBe(404);
    expect(await statusOf(ctl.remove(999))).toBe(404);
  });

  it('still renames a profile to its own name', async () => {
    const p = await ctl.create(input('backend'));
    await expect(ctl.update(p.id, { name: 'backend', enabled: false })).resolves.toMatchObject({ enabled: false });
  });
});
