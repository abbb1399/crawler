import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Noise we do not want one line per request for. */
const QUIET_PATHS = ['/health', '/docs', '/openapi.json', '/admin/queues'];

export function isQuietPath(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0];
  return QUIET_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Caller-supplied x-request-id wins (so a client can correlate), else a fresh UUID. */
export function requestIdFrom(req: Pick<IncomingMessage, 'headers'>): string {
  const h = req.headers['x-request-id'];
  const given = (Array.isArray(h) ? h[0] : h)?.trim();
  return given || randomUUID();
}

/**
 * pino-http options shared by the whole API. One JSON line per request in production, pretty
 * output in development. `req.id` is attached to every log line written during that request
 * (nestjs-pino keeps the request logger in AsyncLocalStorage), so an ErrorBody.requestId leads
 * straight to the related log lines.
 */
export function pinoHttpOptions(env: { NODE_ENV: string; LOG_LEVEL: LogLevel }): Options {
  const production = env.NODE_ENV === 'production';
  return {
    level: env.LOG_LEVEL,
    genReqId: (req) => requestIdFrom(req),
    autoLogging: { ignore: (req) => isQuietPath(req.url) },
    // Keep request/response logs small: no header or body dumps.
    serializers: {
      req: (req: { id?: unknown; method?: string; url?: string }) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
    redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    ...(production
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname', singleLine: true },
          },
        }),
  };
}
