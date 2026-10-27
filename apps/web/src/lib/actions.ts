'use server';

import { JobSource, Region, SearchProfileInput, SearchProfilePatch } from '@trawler/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from './api';
import { requireOwner } from './auth';
import { errorQuery, invalidQuery } from './flash';

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`bad id: ${String(v)}`);
  return n;
}

// --- postings ---------------------------------------------------------------

export async function toggleStar(formData: FormData) {
  await requireOwner('/');
  const id = num(formData.get('id'));
  const starred = formData.get('starred') === 'true';
  await api.patchPosting(id, { starred: !starred });
  revalidatePath('/');
}

export async function toggleHidden(formData: FormData) {
  await requireOwner('/');
  const id = num(formData.get('id'));
  const hidden = formData.get('hidden') === 'true';
  await api.patchPosting(id, { hidden: !hidden });
  revalidatePath('/');
}

// --- profiles ---------------------------------------------------------------

function splitTerms(v: FormDataEntryValue | null): string[] {
  return String(v ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function profileFromForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    keywords: splitTerms(formData.get('keywords')),
    includeTitle: splitTerms(formData.get('includeTitle')),
    excludeTitle: splitTerms(formData.get('excludeTitle')),
    sources: formData.getAll('sources').map(String).filter((s) => JobSource.safeParse(s).success),
    regions: formData.getAll('regions').map(String).filter((s) => Region.safeParse(s).success),
    enabled: formData.get('enabled') === 'on',
  };
}

export async function createProfile(formData: FormData) {
  await requireOwner('/profiles/new');
  const parsed = SearchProfileInput.safeParse(profileFromForm(formData));
  if (!parsed.success) {
    redirect(`/profiles/new?${invalidQuery(parsed.error.issues.map((i) => String(i.path[0])))}`);
  }
  try {
    await api.createProfile(parsed.data);
  } catch (e) {
    redirect(`/profiles/new?${errorQuery(e)}`);
  }
  revalidatePath('/profiles');
  redirect('/profiles');
}

export async function updateProfile(formData: FormData) {
  await requireOwner('/profiles');
  const id = num(formData.get('id'));
  const parsed = SearchProfilePatch.safeParse(profileFromForm(formData));
  if (!parsed.success) {
    redirect(`/profiles/${id}/edit?${invalidQuery(parsed.error.issues.map((i) => String(i.path[0])))}`);
  }
  try {
    await api.updateProfile(id, parsed.data);
  } catch (e) {
    redirect(`/profiles/${id}/edit?${errorQuery(e)}`);
  }
  revalidatePath('/profiles');
  redirect('/profiles');
}

export async function toggleProfileEnabled(formData: FormData) {
  await requireOwner('/profiles');
  const id = num(formData.get('id'));
  const enabled = formData.get('enabled') === 'true';
  await api.updateProfile(id, { enabled: !enabled });
  revalidatePath('/profiles');
}

export async function deleteProfile(formData: FormData) {
  await requireOwner('/profiles');
  const id = num(formData.get('id'));
  await api.deleteProfile(id);
  revalidatePath('/profiles');
}

export async function crawlNow(formData: FormData) {
  await requireOwner('/profiles');
  const id = num(formData.get('id'));
  const jobs = await api.enqueueCrawl(id);
  revalidatePath('/profiles');
  revalidatePath('/runs');
  redirect(`/profiles?queued=${jobs.length}`);
}
