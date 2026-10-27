import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { buildOpenApiDocument } from './openapi';

const SCALAR_VERSION = '1.76.0';

/** The API reference: `/docs` (Scalar UI) reads `/openapi.json`. Both public and read-only. */
@SkipThrottle()
@Controller()
export class DocsController {
  // Built once; the document is static for the lifetime of the process.
  private readonly document = buildOpenApiDocument(process.env['npm_package_version'] ?? '0.0.0');

  @Get('openapi.json')
  openapi() {
    return this.document;
  }

  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  docs(): string {
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>trawler API</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"></script>
  <script>Scalar.createApiReference('#app', { url: '/openapi.json' })</script>
</body>
</html>`;
  }
}
