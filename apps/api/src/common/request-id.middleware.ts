import { randomUUID } from 'node:crypto';

type Req = { id?: unknown; headers: Record<string, string | string[] | undefined> };
type Res = { locals: Record<string, unknown>; setHeader(name: string, value: string): unknown };

/**
 * Exposes the request id to the exception filter (`res.locals.requestId`) and to the client
 * (`x-request-id` response header). pino-http runs first and already set `req.id` from the
 * caller's header or a fresh UUID (logger.config.ts); this reuses it so logs, body and header agree.
 */
export function requestId(req: Req, res: Res, next: () => void): void {
  const incoming = req.headers['x-request-id'];
  const id =
    (typeof req.id === 'string' && req.id) ||
    (typeof req.id === 'number' && String(req.id)) ||
    (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() ||
    randomUUID();
  res.locals['requestId'] = id;
  res.setHeader('x-request-id', id);
  next();
}
