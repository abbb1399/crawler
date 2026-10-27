import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorBody } from '@trawler/shared';
import { Prisma } from '../generated/prisma/client';

type Issue = { path: string; message: string };
type Classified = { status: number; message: string; issues?: Issue[] };

/**
 * Maps any thrown value to one status + message. Exported so the mapping is unit-testable
 * without a Nest application context.
 */
export function classify(exception: unknown): Classified {
  if (exception instanceof ThrottlerException) {
    return { status: HttpStatus.TOO_MANY_REQUESTS, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const r = exception.getResponse();
    if (typeof r === 'string') return { status, message: r };
    const o = r as { message?: unknown; issues?: unknown };
    const message = Array.isArray(o.message)
      ? o.message.map(String).join(', ')
      : typeof o.message === 'string'
        ? o.message
        : exception.message;
    const issues = Array.isArray(o.issues) ? (o.issues as Issue[]) : undefined;
    return issues ? { status, message, issues } : { status, message };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      const target = exception.meta?.['target'] ?? uniqueIndexFields(exception.meta);
      const fields = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : '';
      return { status: HttpStatus.CONFLICT, message: fields ? `이미 존재합니다: ${fields}` : '이미 존재합니다' };
    }
    if (exception.code === 'P2025') return { status: HttpStatus.NOT_FOUND, message: '대상을 찾을 수 없습니다' };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: '내부 오류가 발생했습니다' };
}

/**
 * Prisma 7 with a driver adapter sends no `target`, only the violated index, e.g. "SearchProfile_name_key".
 * Prisma names unique indexes `{Model}_{fields}_key`, so the fields are what is left between the two.
 */
function uniqueIndexFields(meta: Record<string, unknown> | undefined): string | undefined {
  const cause = (meta?.['driverAdapterError'] as { cause?: { table?: string; constraint?: { index?: string } } } | undefined)?.cause;
  const index = cause?.constraint?.index;
  if (!index || !cause?.table || !index.startsWith(`${cause.table}_`) || !index.endsWith('_key')) return undefined;
  return index.slice(cause.table.length + 1, -'_key'.length);
}

/** "NOT_FOUND" → "Not Found" */
export function reasonPhrase(status: number): string {
  const key = HttpStatus[status];
  if (!key) return 'Error';
  return key
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type Req = { method?: string; originalUrl?: string; url?: string };
type Res = { status(code: number): { json(body: unknown): unknown }; locals?: Record<string, unknown> };

/**
 * Every error leaves the API as an ErrorBody (see packages/shared). Validation issues from
 * ZodValidationPipe are kept; Prisma unique/not-found errors become 409/404; anything else is a
 * 500 whose details go to the log only, tagged with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Res>();
    const req = ctx.getRequest<Req>();
    const { status, message, issues } = classify(exception);
    const requestId = typeof res.locals?.['requestId'] === 'string' ? (res.locals['requestId'] as string) : '';
    const path = req.originalUrl ?? req.url ?? '';
    const body: ErrorBody = {
      statusCode: status,
      error: reasonPhrase(status),
      message,
      ...(issues ? { issues } : {}),
      requestId,
      path,
      timestamp: new Date().toISOString(),
    };

    const line = `${req.method ?? ''} ${path} → ${status} ${message} [${requestId}]`;
    if (status >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(line);
    }
    res.status(status).json(body);
  }
}
