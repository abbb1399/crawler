import type {
  CrawlRun,
  EnqueueResult,
  ErrorBody,
  Posting,
  PostingList,
  PostingPatch,
  SearchProfile,
  SearchProfileInput,
  SearchProfilePatch,
  Stats,
} from '@trawler/shared';

/** Server-side only. The browser never talks to the API directly; mutations go through server actions. */
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/** Non-2xx response. `body` is the API's ErrorBody when it sent JSON (always, except network-level failures). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody | null,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorBody | null;
    const msg = (body && typeof body.message === 'string' && body.message) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, body, msg);
  }
  return (await res.json()) as T;
}

export const api = {
  stats: () => call<Stats>('/stats'),

  postings: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const s = qs.toString();
    return call<PostingList>(`/postings${s ? `?${s}` : ''}`);
  },
  patchPosting: (id: number, patch: PostingPatch) =>
    call<Posting>(`/postings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  profiles: () => call<SearchProfile[]>('/profiles'),
  profile: (id: number) => call<SearchProfile>(`/profiles/${id}`),
  createProfile: (input: SearchProfileInput) =>
    call<SearchProfile>('/profiles', { method: 'POST', body: JSON.stringify(input) }),
  updateProfile: (id: number, patch: SearchProfilePatch) =>
    call<SearchProfile>(`/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProfile: (id: number) => call<{ deleted: number }>(`/profiles/${id}`, { method: 'DELETE' }),

  enqueueCrawl: (profileId: number) =>
    call<EnqueueResult[]>(`/crawl?profileId=${profileId}`, { method: 'POST' }),

  runs: (limit = 50) => call<CrawlRun[]>(`/runs?limit=${limit}`),
};
