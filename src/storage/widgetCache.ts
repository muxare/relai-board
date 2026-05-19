const PREFIX = 'relai-board:widget-cache:';

export interface CachedResult<T> {
  fetchedAt: number;
  data: T;
}

export function readCache<T>(key: string): CachedResult<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedResult<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): CachedResult<T> {
  const entry: CachedResult<T> = { fetchedAt: Date.now(), data };
  localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  return entry;
}

export function clearCache(key: string): void {
  localStorage.removeItem(PREFIX + key);
}
