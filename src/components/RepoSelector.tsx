import { useState, useEffect, useRef, useCallback } from 'react';
import { GitHubAPI } from '../api/github';
import type { Repo } from '../types/github';
import { togglePinned } from '../storage/pinnedRepos';
import { usePinnedRepos } from '../storage/usePinnedRepos';

const RECENT_KEY = 'relai-board:recent-repos';
const MAX_RECENT = 10;

interface RepoSelectorProps {
  currentRepo: string;
  token: string;
  onSelect: (repo: string) => void;
}

export function getRecentRepos(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
}

export function pushRecentRepo(repo: string): void {
  const current = getRecentRepos().filter((r) => r !== repo);
  current.unshift(repo);
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(current.slice(0, MAX_RECENT)),
  );
}

export function RepoSelector({
  currentRepo,
  token,
  onSelect,
}: RepoSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allRepos, setAllRepos] = useState<Repo[] | null>(null);
  const [searchResults, setSearchResults] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const pinned = usePinnedRepos();
  const pinnedSet = new Set(pinned);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setRecent(getRecentRepos());
  }, [open]);

  // Fetch user repos on first open
  useEffect(() => {
    if (!open || allRepos !== null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const api = new GitHubAPI(token);
    api
      .getUserRepos()
      .then((repos) => {
        if (!cancelled) setAllRepos(repos);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, allRepos, token]);

  // Focus search on open
  useEffect(() => {
    if (open) searchInputRef.current?.focus();
    else {
      setQuery('');
      setDebouncedQuery('');
      setHighlight(0);
    }
  }, [open]);

  // Debounce query
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Fire search when debounced query is long enough and not well-matched locally
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const localMatches = (allRepos ?? []).filter((r) =>
      r.full_name.toLowerCase().includes(debouncedQuery.toLowerCase()),
    );
    if (localMatches.length >= 5) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const api = new GitHubAPI(token);
    api
      .searchRepos(debouncedQuery)
      .then((repos) => {
        if (!cancelled) setSearchResults(repos);
      })
      .catch(() => {
        /* ignore search errors silently */
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, allRepos, token]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSelect = useCallback(
    (repo: string) => {
      if (repo === currentRepo) {
        setOpen(false);
        return;
      }
      onSelect(repo);
      setOpen(false);
    },
    [currentRepo, onSelect],
  );

  const lowerQuery = debouncedQuery.toLowerCase();
  const filterByQuery = (list: string[]) =>
    lowerQuery
      ? list.filter((n) => n.toLowerCase().includes(lowerQuery))
      : list;

  const recentSection = filterByQuery(recent);
  const seenNames = new Set(recentSection);
  const mergedAll = [
    ...(allRepos ?? []).map((r) => r.full_name),
    ...searchResults.map((r) => r.full_name),
  ];
  const allSection = Array.from(new Set(filterByQuery(mergedAll))).filter(
    (n) => !seenNames.has(n),
  );

  const flatList = [...recentSection, ...allSection];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatList[highlight]) handleSelect(flatList[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  let runningIndex = 0;
  const renderItem = (name: string) => {
    const idx = runningIndex++;
    const active = idx === highlight;
    const selected = name === currentRepo;
    const isPinnedNow = pinnedSet.has(name);
    return (
      <div
        key={name}
        className={`repo-selector-item ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}
        onMouseEnter={() => setHighlight(idx)}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelect(name);
        }}
      >
        <span className="repo-selector-item-name">{name}</span>
        <button
          type="button"
          className={`repo-selector-pin ${isPinnedNow ? 'pinned' : ''}`}
          title={isPinnedNow ? 'Unpin from dashboard' : 'Pin to dashboard'}
          aria-label={isPinnedNow ? 'Unpin repository' : 'Pin repository'}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePinned(name);
          }}
        >
          {isPinnedNow ? '★' : '☆'}
        </button>
      </div>
    );
  };

  return (
    <div className="repo-selector" ref={containerRef}>
      <button
        type="button"
        className="repo-selector-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {currentRepo || 'Select a repository...'}
        <span className="repo-selector-caret">▾</span>
      </button>
      {open && (
        <div className="repo-selector-dropdown">
          <input
            ref={searchInputRef}
            className="repo-selector-search"
            placeholder="Search repositories..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="repo-selector-list">
            {error && <div className="repo-selector-error">{error}</div>}
            {recentSection.length > 0 && (
              <>
                <div className="repo-selector-section">Recent</div>
                {recentSection.map(renderItem)}
              </>
            )}
            {allSection.length > 0 && (
              <>
                <div className="repo-selector-section">All repositories</div>
                {allSection.map(renderItem)}
              </>
            )}
            {loading &&
              allSection.length === 0 &&
              recentSection.length === 0 && (
                <div className="repo-selector-empty">Loading...</div>
              )}
            {!loading && !error && flatList.length === 0 && (
              <div className="repo-selector-empty">No repositories found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
