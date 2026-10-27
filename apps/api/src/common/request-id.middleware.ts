import { randomUUID } from 'node:crypto';

type Req = { headers: Record<string, string | string[] | undefined> };
type Res = { locals: Record<string, unknown>; setHeader(name: string, value: string): unknown };

/**
 * Gives every request an id: the caller's `x-request-id` if present, else a UUID. Stored on
 * `res.locals.requestId` for the exception filter and echoed back as a response header so a
 * failing call can be matched to the server log.
 */
export function requestId(req: Req, res: Res, next: () => void): void {
  const incoming = req.headers['x-request-id'];
  const id = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
  res.locals['requestId'] = id;
  res.setHeader('x-request-id', id);
  next();
}
