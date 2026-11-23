const PREFIX = 'relai-board:widget-cache:';

export interface CachedResult<T> {
  fetchedAt: number;
  /** The pinned set the data was fetched for; see `pinnedSetKey`. */
  pinnedSet: string;
  data: T;
}

/** Identifies a set of pinned repos regardless of the order they were pinned. */
export function pinnedSetKey(pinnedRepos: string[]): string {
  return pinnedRepos.slice().sort().join(',');
}

/**
 * Returns null when the entry was fetched for another pinned set. That includes
 * entries from before the set was recorded. The set lives in the entry and not
 * in the storage key, so each widget keeps a single entry that is overwritten.
 */
export function readCache<T>(
  key: string,
  pinnedSet: string,
): CachedResult<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedResult<T> | null;
    return entry?.pinnedSet === pinnedSet ? entry : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(
  key: string,
  pinnedSet: string,
  data: T,
): CachedResult<T> {
  const entry: CachedResult<T> = { fetchedAt: Date.now(), pinnedSet, data };
  localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  return entry;
}

export function clearCache(key: string): void {
  localStorage.removeItem(PREFIX + key);
}
