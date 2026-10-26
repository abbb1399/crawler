/**
 * Owner check: any of the signed-in user's emails is in OWNER_EMAILS (comma-separated,
 * case-insensitive). An empty list means nobody is the owner — fail closed.
 */
export function isOwner(emails: string[], ownerList: string | undefined): boolean {
  const owners = new Set(
    (ownerList ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (owners.size === 0) return false;
  return emails.some((e) => owners.has(e.trim().toLowerCase()));
}
