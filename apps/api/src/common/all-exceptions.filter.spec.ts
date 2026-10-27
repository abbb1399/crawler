import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorBody } from '@trawler/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { AllExceptionsFilter, classify, reasonPhrase } from './all-exceptions.filter';

beforeAll(() => {
  Logger.overrideLogger(false); // keep test output clean
});

/** Minimal ArgumentsHost double: records the status/body the filter sends. */
function run(exception: unknown, opts: { requestId?: string; url?: string; method?: string } = {}) {
  let sentStatus = 0;
  let sentBody: ErrorBody | undefined;
  const res = {
    locals: opts.requestId ? { requestId: opts.requestId } : {},
    status(code: number) {
      sentStatus = code;
      return { json: (b: unknown) => void (sentBody = b as ErrorBody) };
    },
  };
  const req = { method: opts.method ?? 'GET', originalUrl: opts.url ?? '/x' };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) };
  new AllExceptionsFilter().catch(exception, host as never);
  return { status: sentStatus, body: sentBody! };
}

describe('classify', () => {
  it('keeps the status and message of plain HttpExceptions', () => {
    expect(classify(new NotFoundException('posting 7 not found'))).toEqual({ status: 404, message: 'posting 7 not found' });
    expect(classify(new ConflictException('profile "x" already exists'))).toEqual({ status: 409, message: 'profile "x" already exists' });
  });

  it('keeps validation issues from ZodValidationPipe', () => {
    const e = new BadRequestException({ message: 'validation failed', issues: [{ path: 'hidden', message: 'expected boolean' }] });
    expect(classify(e)).toEqual({ status: 400, message: 'validation failed', issues: [{ path: 'hidden', message: 'expected boolean' }] });
  });

  it('translates throttling', () => {
    expect(classify(new ThrottlerException())).toMatchObject({ status: 429, message: expect.stringContaining('요청이 너무 많습니다') });
  });

  it('maps Prisma unique violations to 409 with the fields, and missing rows to 404', () => {
    const dup = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      // What Prisma 7 with the pg driver adapter really sends (no `target`).
      meta: {
        modelName: 'SearchProfile',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'SearchProfile_name_key' }, table: 'SearchProfile' },
        },
      },
    });
    expect(classify(dup)).toEqual({ status: 409, message: '이미 존재합니다: name' });
    const legacy = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['source', 'externalId'] },
    });
    expect(classify(legacy)).toEqual({ status: 409, message: '이미 존재합니다: source, externalId' });
    const missing = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' });
    expect(classify(missing)).toEqual({ status: 404, message: '대상을 찾을 수 없습니다' });
  });

  it('hides the details of unknown errors behind a generic 500', () => {
    expect(classify(new Error('connect ECONNREFUSED 10.0.0.5:5432'))).toEqual({ status: 500, message: '내부 오류가 발생했습니다' });
    expect(classify('weird string')).toMatchObject({ status: 500 });
  });
});

describe('reasonPhrase', () => {
  it('turns the HttpStatus key into words', () => {
    expect(reasonPhrase(404)).toBe('Not Found');
    expect(reasonPhrase(429)).toBe('Too Many Requests');
    expect(reasonPhrase(500)).toBe('Internal Server Error');
    expect(reasonPhrase(999)).toBe('Error');
  });
});

describe('AllExceptionsFilter.catch', () => {
  it('sends an ErrorBody with request id, path and timestamp', () => {
    const { status, body } = run(new NotFoundException('profile 9 not found'), { requestId: 'req-1', url: '/profiles/9' });
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, error: 'Not Found', message: 'profile 9 not found', requestId: 'req-1', path: '/profiles/9' });
    expect(body.issues).toBeUndefined();
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('includes issues for validation errors', () => {
    const { body } = run(new BadRequestException({ message: 'validation failed', issues: [{ path: 'name', message: 'too short' }] }));
    expect(body.issues).toEqual([{ path: 'name', message: 'too short' }]);
  });

  it('never leaks the original message of an unexpected error', () => {
    const { status, body } = run(new Error('secret internal detail'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
    expect(body.requestId).toBe('');
  });
});
