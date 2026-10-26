import { BadRequestException } from '@nestjs/common';
import { PostingPatch } from '@trawler/shared';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(PostingPatch);

  it('returns the parsed value', () => {
    expect(pipe.transform({ hidden: true })).toEqual({ hidden: true });
  });

  it('throws a 400 whose body lists the failing paths', () => {
    let caught: unknown;
    try {
      pipe.transform({ hidden: 'yes' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const body = (caught as BadRequestException).getResponse() as { message: string; issues: { path: string }[] };
    expect(body.message).toBe('validation failed');
    expect(body.issues.map((i) => i.path)).toEqual(['hidden']);
  });

  it('surfaces refine errors (empty patch) too', () => {
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });
});
