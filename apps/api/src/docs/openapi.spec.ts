import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';

/** Every route the controllers expose (keep in sync when adding a controller method). */
const ROUTES: [method: string, path: string][] = [
  ['get', '/health'],
  ['get', '/postings'],
  ['patch', '/postings/{id}'],
  ['get', '/profiles'],
  ['post', '/profiles'],
  ['get', '/profiles/{id}'],
  ['patch', '/profiles/{id}'],
  ['delete', '/profiles/{id}'],
  ['get', '/runs'],
  ['post', '/crawl/{source}'],
  ['post', '/crawl'],
  ['post', '/crawl/{source}/sync'],
  ['post', '/maintenance/expire'],
  ['post', '/maintenance/notify'],
  ['post', '/maintenance/test-alert'],
  ['get', '/queues'],
  ['get', '/stats'],
];

const doc = buildOpenApiDocument('1.2.3') as unknown as {
  openapi: string;
  info: { version: string };
  paths: Record<string, Record<string, { responses: Record<string, unknown>; parameters?: { name: string; in: string; schema: Record<string, unknown> }[] }>>;
  components: { schemas: Record<string, unknown> };
};

describe('OpenAPI document', () => {
  it('builds and serializes', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBe('1.2.3');
    expect(() => JSON.stringify(doc)).not.toThrow();
  });

  it('documents every controller route, and nothing else', () => {
    const documented = Object.entries(doc.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`));
    const expected = ROUTES.map(([m, p]) => `${m} ${p}`);
    expect(documented.sort()).toEqual(expected.sort());
  });

  it('declares the shared error shape and the main contracts as components', () => {
    for (const name of ['ErrorBody', 'Posting', 'PostingList', 'SearchProfile', 'CrawlRun', 'Stats', 'DispatchResult']) {
      expect(doc.components.schemas[name], name).toBeDefined();
    }
  });

  it('gives every operation 429 and 500 responses that reference ErrorBody', () => {
    for (const [p, ops] of Object.entries(doc.paths)) {
      for (const [m, operation] of Object.entries(ops)) {
        for (const code of ['429', '500']) {
          expect(JSON.stringify(operation.responses[code]), `${m} ${p} ${code}`).toContain('#/components/schemas/ErrorBody');
        }
      }
    }
  });

  it('renders query booleans (z.stringbool) as "true"/"false" strings', () => {
    const params = doc.paths['/postings'].get.parameters ?? [];
    const hidden = params.find((q) => q.name === 'hidden');
    expect(hidden?.in).toBe('query');
    expect(hidden?.schema).toMatchObject({ type: 'string', enum: ['true', 'false'] });
    const page = params.find((q) => q.name === 'page');
    expect(page?.schema).toMatchObject({ type: 'integer', default: 1 });
  });
});
