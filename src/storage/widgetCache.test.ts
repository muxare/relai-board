import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinnedSetKey, readCache, writeCache } from './widgetCache';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('widgetCache', () => {
  it('ignores the order in which repos were pinned', () => {
    const pinned = ['o/b', 'o/a'];
    writeCache('w', pinnedSetKey(pinned), [1]);
    expect(readCache('w', pinnedSetKey(['o/a', 'o/b']))?.data).toEqual([1]);
    expect(pinned).toEqual(['o/b', 'o/a']);
  });

  it('misses for another set and keeps one entry per widget', () => {
    writeCache('w', pinnedSetKey(['o/a']), [1]);
    expect(readCache('w', pinnedSetKey(['o/a', 'o/b']))).toBeNull();
    writeCache('w', pinnedSetKey(['o/a', 'o/b']), [2]);
    expect(store.size).toBe(1);
  });

  it.each([
    ['an entry from the old version', '{"fetchedAt":1,"data":[1]}'],
    ['a null entry', 'null'],
    ['malformed JSON', '{'],
  ])('treats %s as a miss', (_, raw) => {
    store.set('relai-board:widget-cache:w', raw);
    expect(readCache('w', pinnedSetKey([]))).toBeNull();
    expect(readCache('w', pinnedSetKey(['o/a']))).toBeNull();
  });
});
