import { describe, expect, it } from 'vitest';
import { isQuietPath, pinoHttpOptions, requestIdFrom } from './logger.config';

describe('requestIdFrom', () => {
  it('keeps a caller-supplied x-request-id', () => {
    expect(requestIdFrom({ headers: { 'x-request-id': ' abc-123 ' } })).toBe('abc-123');
    expect(requestIdFrom({ headers: { 'x-request-id': ['first', 'second'] } })).toBe('first');
  });

  it('generates a UUID otherwise', () => {
    expect(requestIdFrom({ headers: {} })).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom({ headers: { 'x-request-id': '  ' } })).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('isQuietPath', () => {
  it('silences health, docs and Bull Board but not real API routes', () => {
    for (const p of ['/health', '/docs', '/openapi.json', '/admin/queues', '/admin/queues/api/jobs?x=1', '/health?deep=1']) {
      expect(isQuietPath(p), p).toBe(true);
    }
    for (const p of ['/postings', '/healthz', '/runs', undefined]) {
      expect(isQuietPath(p), String(p)).toBe(false);
    }
  });
});

describe('pinoHttpOptions', () => {
  it('is plain JSON at the configured level in production', () => {
    const o = pinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(o.level).toBe('info');
    expect(o).not.toHaveProperty('transport');
  });

  it('pretty-prints in development', () => {
    const o = pinoHttpOptions({ NODE_ENV: 'development', LOG_LEVEL: 'debug' }) as { transport?: { target: string } };
    expect(o.transport?.target).toBe('pino-pretty');
  });

  it('redacts credentials and keeps serializers minimal', () => {
    const o = pinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    expect(o.redact).toMatchObject({ paths: ['req.headers.authorization', 'req.headers.cookie'] });
    const req = (o.serializers as { req: (r: unknown) => unknown }).req({ id: 'r1', method: 'GET', url: '/x', headers: { cookie: 'secret' } });
    expect(req).toEqual({ id: 'r1', method: 'GET', url: '/x' });
  });

  it('maps status codes to levels', () => {
    const o = pinoHttpOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    const level = o.customLogLevel as (req: unknown, res: { statusCode: number }, err?: Error) => string;
    expect(level({}, { statusCode: 200 })).toBe('info');
    expect(level({}, { statusCode: 404 })).toBe('warn');
    expect(level({}, { statusCode: 500 })).toBe('error');
    expect(level({}, { statusCode: 200 }, new Error('x'))).toBe('error');
  });
});
