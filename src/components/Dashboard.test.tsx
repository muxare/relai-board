import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import type { GitHubAPI } from '../api/github';
import { pinRepo, unpinRepo } from '../storage/pinnedRepos';
import type { SearchIssue, Viewer } from '../types/github';
import { Dashboard } from './Dashboard';

const REVIEW = 'prs-awaiting-review';
const YOURS = 'your-open-prs';
const ASSIGNED = 'issues-assigned';
const ALL = [REVIEW, YOURS, ASSIGNED];
const CACHE_PREFIX = 'relai-board:widget-cache:';

const viewer: Viewer = { login: 'me', avatar_url: '', name: null };

interface Call {
  widget: string;
  query: string;
  resolve: (items: SearchIssue[]) => Promise<void>;
  reject: (message: string) => Promise<void>;
}

function makeRow(repo: string, number: number, title: string): SearchIssue {
  return {
    number,
    title,
    state: 'open',
    html_url: `https://github.com/${repo}/pull/${number}`,
    repository_url: `https://api.github.com/repos/${repo}`,
    updated_at: '2026-11-20T00:00:00Z',
    created_at: '2026-11-20T00:00:00Z',
    user: null,
    labels: [],
    pull_request: { url: '', html_url: '' },
  };
}

function widgetOf(query: string): string {
  if (query.includes('review-requested:')) return REVIEW;
  return query.includes('author:') ? YOURS : ASSIGNED;
}

/** An API whose searches stay pending until the test settles them. */
function makeApi() {
  const calls: Call[] = [];
  const mergePr = vi.fn(() => Promise.resolve());
  const getViewer = vi.fn(() => Promise.resolve(viewer));
  const searchIssues = (query: string) =>
    new Promise<SearchIssue[]>((res, rej) => {
      calls.push({
        widget: widgetOf(query),
        query,
        resolve: (items) => act(async () => res(items)),
        reject: (message) => act(async () => rej(new Error(message))),
      });
    });
  const api = { getViewer, searchIssues, mergePr };
  return { calls, mergePr, getViewer, api: api as unknown as GitHubAPI };
}

type FakeApi = ReturnType<typeof makeApi>;

function callsFor(fake: FakeApi, widget: string): Call[] {
  return fake.calls.filter((c) => c.widget === widget);
}

async function mount(fake: FakeApi) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Dashboard api={fake.api} />);
  });
  return result;
}

function seedCache(widget: string, pinnedSet: string, data: SearchIssue[]) {
  localStorage.setItem(
    CACHE_PREFIX + widget,
    JSON.stringify({ fetchedAt: Date.now(), pinnedSet, data }),
  );
}

function cachedTitles(widget: string): string[] | null {
  const raw = localStorage.getItem(CACHE_PREFIX + widget);
  if (!raw) return null;
  return (JSON.parse(raw) as { data: SearchIssue[] }).data.map((d) => d.title);
}

function section(title: string) {
  const el = screen.getByText(title).closest('section');
  if (!el) throw new Error(`No widget section titled ${title}`);
  return within(el);
}

function refreshButton(): HTMLButtonElement {
  const [button] = section('Your open PRs').getAllByRole('button');
  return button as HTMLButtonElement;
}

const mergeButton = () =>
  screen.getByTitle('Squash-merge this PR') as HTMLButtonElement;

// Node 25 defines its own `localStorage`, unusable without a backing file, which
// shadows the jsdom one. Stubbing it keeps the tests independent of Node version.
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Dashboard row actions', () => {
  beforeEach(() => {
    pinRepo('o/a');
    seedCache(REVIEW, 'o/a', []);
    seedCache(YOURS, 'o/a', [makeRow('o/a', 1, 'First PR')]);
    seedCache(ASSIGNED, 'o/a', []);
  });

  it('refetches only the affected widget after a successful action', async () => {
    const fake = makeApi();
    await mount(fake);
    expect(fake.calls).toHaveLength(0);

    await act(async () => {
      fireEvent.click(mergeButton());
    });
    expect(fake.mergePr).toHaveBeenCalledTimes(1);
    expect(fake.calls.map((c) => c.widget)).toEqual([YOURS]);

    await fake.calls[0].resolve([]);
    expect(screen.queryByText('First PR')).toBeNull();
    expect(cachedTitles(YOURS)).toEqual([]);
  });

  it('keeps the row busy until the refetch has finished', async () => {
    const fake = makeApi();
    await mount(fake);
    await act(async () => {
      fireEvent.click(mergeButton());
    });
    expect(mergeButton().disabled).toBe(true);

    await fake.calls[0].resolve([makeRow('o/a', 1, 'First PR')]);
    expect(mergeButton().disabled).toBe(false);
  });

  it('does not refetch when the action fails', async () => {
    const fake = makeApi();
    fake.mergePr.mockRejectedValueOnce(new Error('conflict'));
    await mount(fake);
    await act(async () => {
      fireEvent.click(mergeButton());
    });
    expect(fake.calls).toHaveLength(0);
    expect(screen.getByTitle('conflict')).toBeTruthy();
    expect(mergeButton().disabled).toBe(false);
  });

  it('refetches for the current pinned set when it changed during the action', async () => {
    const fake = makeApi();
    let finishMerge!: () => void;
    fake.mergePr.mockReturnValueOnce(
      new Promise<void>((res) => {
        finishMerge = res;
      }),
    );
    await mount(fake);
    await act(async () => {
      fireEvent.click(mergeButton());
    });
    await act(async () => pinRepo('o/b'));
    await act(async () => finishMerge());

    const last = callsFor(fake, YOURS).at(-1)!;
    expect(callsFor(fake, YOURS)).toHaveLength(2);
    expect(last.query).toContain('repo:o/b');
  });

  it('refetches on the next mount when the action ends after unmounting', async () => {
    const fake = makeApi();
    let finishMerge!: () => void;
    fake.mergePr.mockReturnValueOnce(
      new Promise<void>((res) => {
        finishMerge = res;
      }),
    );
    const { unmount } = await mount(fake);
    await act(async () => {
      fireEvent.click(mergeButton());
    });
    unmount();
    await act(async () => finishMerge());
    expect(fake.calls).toHaveLength(0);

    await mount(fake);
    expect(fake.calls.map((c) => c.widget)).toEqual([YOURS]);
  });

  it('refetches once the viewer is known when the action ends before that', async () => {
    const fake = makeApi();
    let finishViewer!: (v: Viewer) => void;
    fake.getViewer.mockReturnValueOnce(
      new Promise<Viewer>((res) => {
        finishViewer = res;
      }),
    );
    await mount(fake);
    await act(async () => {
      fireEvent.click(mergeButton());
    });
    expect(fake.calls).toHaveLength(0);

    await act(async () => finishViewer(viewer));
    expect(fake.calls.map((c) => c.widget)).toEqual([YOURS]);
  });
});

describe('Dashboard pinned-set changes', () => {
  function seedAll(pinnedSet: string) {
    ALL.forEach((w) =>
      seedCache(w, pinnedSet, [makeRow('o/a', 1, `Old ${w}`)]),
    );
  }

  it('uses the cache without fetching when the set is unchanged', async () => {
    pinRepo('o/b');
    pinRepo('o/a');
    seedAll('o/a,o/b');
    const fake = makeApi();
    await mount(fake);
    expect(fake.calls).toHaveLength(0);
    expect(screen.getByText(`Old ${YOURS}`)).toBeTruthy();
  });

  it('uses what it wrote itself on the next mount', async () => {
    pinRepo('o/a');
    const fake = makeApi();
    const { unmount } = await mount(fake);
    for (const c of fake.calls.slice()) {
      await c.resolve([makeRow('o/a', 2, `New ${c.widget}`)]);
    }
    unmount();

    const second = makeApi();
    await mount(second);
    expect(second.calls).toHaveLength(0);
    expect(screen.getByText(`New ${YOURS}`)).toBeTruthy();
  });

  it('fetches each widget once under StrictMode', async () => {
    pinRepo('o/a');
    const fake = makeApi();
    await act(async () => {
      render(
        <StrictMode>
          <Dashboard api={fake.api} />
        </StrictMode>,
      );
    });
    expect(fake.calls.map((c) => c.widget)).toEqual(ALL);
    await callsFor(fake, YOURS)[0].resolve([makeRow('o/a', 2, 'Fresh')]);
    expect(screen.getByText('Fresh')).toBeTruthy();
  });

  it.each([
    ['pinning', () => pinRepo('o/b'), ['o/a', 'o/b', 'o/c']],
    ['unpinning', () => unpinRepo('o/c'), ['o/a']],
  ])('refetches every widget after %s a repo', async (_, change, repos) => {
    pinRepo('o/a');
    pinRepo('o/c');
    seedAll('o/a,o/c');
    const fake = makeApi();
    await mount(fake);
    expect(fake.calls).toHaveLength(0);

    await act(async () => {
      change();
    });
    expect(fake.calls.map((c) => c.widget)).toEqual(ALL);
    for (const c of fake.calls) {
      expect(c.query.match(/repo:\S+/g)?.sort()).toEqual(
        repos.map((r) => `repo:${r}`),
      );
    }
    ALL.forEach((w) => expect(screen.queryByText(`Old ${w}`)).toBeNull());
    expect(screen.getAllByText('Loading…')).toHaveLength(3);
  });

  it('treats a cache entry from another set as a miss on mount', async () => {
    pinRepo('o/b');
    seedAll('o/a');
    const fake = makeApi();
    await mount(fake);
    expect(fake.calls.map((c) => c.widget)).toEqual(ALL);
    expect(screen.queryByText(`Old ${YOURS}`)).toBeNull();
  });

  it('treats an entry written by the old version as a miss', async () => {
    pinRepo('o/a');
    ALL.forEach((w) =>
      localStorage.setItem(
        CACHE_PREFIX + w,
        JSON.stringify({ fetchedAt: 1, data: [makeRow('o/a', 1, 'Legacy')] }),
      ),
    );
    const fake = makeApi();
    await mount(fake);
    expect(fake.calls.map((c) => c.widget)).toEqual(ALL);
    expect(screen.queryByText('Legacy')).toBeNull();
  });

  it('shows no old data when the refetch for the new set fails', async () => {
    pinRepo('o/a');
    seedAll('o/a');
    const fake = makeApi();
    await mount(fake);
    await act(async () => pinRepo('o/b'));
    await callsFor(fake, YOURS)[0].reject('boom');
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.queryByText(`Old ${YOURS}`)).toBeNull();
    expect(refreshButton().disabled).toBe(false);
  });
});

describe('Dashboard out-of-order responses', () => {
  async function pinDuringFetch() {
    pinRepo('o/a');
    const fake = makeApi();
    await mount(fake);
    await act(async () => pinRepo('o/b'));
    const [older, newer] = callsFor(fake, YOURS);
    return { fake, older, newer };
  }

  it('discards a late response for the previous pinned set', async () => {
    const { older, newer } = await pinDuringFetch();
    await newer.resolve([makeRow('o/b', 2, 'Newer')]);
    await older.resolve([makeRow('o/a', 1, 'Older')]);
    expect(screen.queryByText('Older')).toBeNull();
    expect(screen.getByText('Newer')).toBeTruthy();
    expect(cachedTitles(YOURS)).toEqual(['Newer']);
    expect(refreshButton().disabled).toBe(false);
  });

  it('keeps loading when the older response arrives first', async () => {
    const { older, newer } = await pinDuringFetch();
    await older.resolve([makeRow('o/a', 1, 'Older')]);
    expect(screen.queryByText('Older')).toBeNull();
    expect(cachedTitles(YOURS)).toBeNull();
    expect(refreshButton().disabled).toBe(true);

    await newer.resolve([makeRow('o/b', 2, 'Newer')]);
    expect(screen.getByText('Newer')).toBeTruthy();
    expect(refreshButton().disabled).toBe(false);
  });

  it('discards a late failure for the previous pinned set', async () => {
    const { older, newer } = await pinDuringFetch();
    await newer.resolve([makeRow('o/b', 2, 'Newer')]);
    await older.reject('stale failure');
    expect(screen.queryByText('stale failure')).toBeNull();
    expect(screen.getByText('Newer')).toBeTruthy();
  });

  it('discards a late response from an earlier refresh of the same set', async () => {
    pinRepo('o/a');
    ALL.forEach((w) => seedCache(w, 'o/a', []));
    const fake = makeApi();
    await mount(fake);
    const refreshAll = screen.getByText('↻ Refresh all');
    await act(async () => {
      fireEvent.click(refreshAll);
    });
    await act(async () => {
      fireEvent.click(refreshAll);
    });
    const [older, newer] = callsFor(fake, YOURS);
    await newer.resolve([makeRow('o/a', 2, 'Newer')]);
    await older.resolve([makeRow('o/a', 1, 'Older')]);
    expect(screen.queryByText('Older')).toBeNull();
    expect(cachedTitles(YOURS)).toEqual(['Newer']);
    expect(refreshButton().disabled).toBe(false);
  });

  it('keeps a response that arrives after unmounting out of the cache', async () => {
    pinRepo('o/a');
    const fake = makeApi();
    const { unmount } = await mount(fake);
    unmount();

    const second = makeApi();
    await mount(second);
    await callsFor(second, YOURS)[0].resolve([makeRow('o/a', 2, 'Newer')]);
    await callsFor(fake, YOURS)[0].resolve([makeRow('o/a', 1, 'Older')]);
    expect(cachedTitles(YOURS)).toEqual(['Newer']);
  });
});
