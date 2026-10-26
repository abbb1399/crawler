import { JobSource } from '@trawler/shared';
import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

/**
 * URL state of the postings list. Shared by the server page (loader/serializer) and the
 * client filter bar (useQueryStates), so both agree on keys, parsing and defaults.
 * Defaults are dropped from the URL (nuqs clearOnDefault).
 */
export const postingsSearchParams = {
  q: parseAsString.withDefault(''),
  /** null = all sources */
  source: parseAsStringLiteral(JobSource.options),
  newToday: parseAsBoolean.withDefault(false),
  hidden: parseAsBoolean.withDefault(false),
  starred: parseAsBoolean.withDefault(false),
  expired: parseAsBoolean.withDefault(false),
  page: parseAsInteger.withDefault(1),
  /** One-shot message from a rejected server action (e.g. not the owner). */
  error: parseAsString,
};

export const loadPostingsSearchParams = createLoader(postingsSearchParams);
export const serializePostingsSearchParams = createSerializer(postingsSearchParams);
