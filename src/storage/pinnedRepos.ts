const PINNED_KEY = 'relai-board:pinned-repos';

type Listener = (pinned: string[]) => void;
const listeners = new Set<Listener>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
}

function write(next: string[]): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  listeners.forEach((l) => l(next));
}

export function getPinnedRepos(): string[] {
  return read();
}

export function isPinned(repo: string): boolean {
  return read().includes(repo);
}

export function pinRepo(repo: string): void {
  const current = read();
  if (current.includes(repo)) return;
  write([...current, repo]);
}

export function unpinRepo(repo: string): void {
  const current = read();
  const next = current.filter((r) => r !== repo);
  if (next.length === current.length) return;
  write(next);
}

export function togglePinned(repo: string): boolean {
  const current = read();
  if (current.includes(repo)) {
    write(current.filter((r) => r !== repo));
    return false;
  }
  write([...current, repo]);
  return true;
}

export function subscribePinned(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
