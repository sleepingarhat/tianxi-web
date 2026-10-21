/** Publication grace is not a later prediction lock or permission to recompute. */
export const FREEZE_PUBLICATION_GRACE_MS = 30 * 60_000;

export function freezePublicationPending(lockAt: unknown, evidenceCode: unknown, now = Date.now()): boolean {
  if (evidenceCode !== 'no-archive' || typeof lockAt !== 'string') return false;
  const lockedAt = Date.parse(lockAt);
  return Number.isFinite(lockedAt) && now >= lockedAt && now <= lockedAt + FREEZE_PUBLICATION_GRACE_MS;
}

export function freezePublicationDeadline(lockAt: string): string {
  return new Date(Date.parse(lockAt) + FREEZE_PUBLICATION_GRACE_MS).toISOString();
}