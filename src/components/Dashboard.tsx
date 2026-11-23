import { useCallback, useEffect, useRef, useState } from 'react';
import { GitHubAPI } from '../api/github';
import type { SearchIssue, Viewer } from '../types/github';
import { usePinnedRepos } from '../storage/usePinnedRepos';
import {
  clearCache,
  pinnedSetKey,
  readCache,
  writeCache,
} from '../storage/widgetCache';
import { widgets } from '../widgets/registry';
import type { Widget, WidgetContext } from '../widgets/types';

interface DashboardProps {
  api: GitHubAPI;
}

interface WidgetState {
  /** The pinned set that the rest of the state belongs to. */
  pinnedSet: string;
  data: SearchIssue[] | null;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

function emptyState(pinnedSet: string): WidgetState {
  return {
    pinnedSet,
    data: null,
    fetchedAt: null,
    loading: false,
    error: null,
  };
}

function formatRelative(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function Dashboard({ api }: DashboardProps) {
  const pinnedRepos = usePinnedRepos();
  const pinnedSet = pinnedSetKey(pinnedRepos);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [states, setStates] = useState<Record<string, WidgetState>>(() => {
    const initial: Record<string, WidgetState> = {};
    for (const w of widgets) {
      const cached = readCache<SearchIssue[]>(w.id, pinnedSet);
      initial[w.id] = { ...emptyState(pinnedSet), ...cached };
    }
    return initial;
  });

  useEffect(() => {
    let alive = true;
    api
      .getViewer()
      .then((v) => {
        if (alive) setViewer(v);
      })
      .catch((e) => {
        if (alive) setViewerError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [api]);

  // The context to fetch with right now, or null before the viewer is known and
  // after unmounting. A row action can finish long after the render it started
  // in, so its refresh must not use the pinned set of that render.
  const currentCtx = useRef<WidgetContext | null>(null);
  useEffect(() => {
    currentCtx.current = viewer ? { api, viewer, pinnedRepos } : null;
    return () => {
      currentCtx.current = null;
    };
  }, [api, viewer, pinnedRepos]);

  // Per widget, the number of the newest request. Only that one may touch state
  // or cache; it also owns `loading`, so a discarded response need not clear it.
  const latestRequest = useRef<Record<string, number>>({});

  const runWidget = useCallback(async (widget: Widget<SearchIssue[]>) => {
    const ctx = currentCtx.current;
    if (!ctx) return;
    const fetchedSet = pinnedSetKey(ctx.pinnedRepos);
    const request = (latestRequest.current[widget.id] ?? 0) + 1;
    latestRequest.current[widget.id] = request;
    const isCurrent = () =>
      currentCtx.current !== null &&
      latestRequest.current[widget.id] === request;

    setStates((s) => {
      const prev = s[widget.id];
      const base =
        prev.pinnedSet === fetchedSet ? prev : emptyState(fetchedSet);
      return { ...s, [widget.id]: { ...base, loading: true, error: null } };
    });
    try {
      const data = await widget.fetch(ctx);
      if (!isCurrent()) return;
      const entry = writeCache(widget.id, fetchedSet, data);
      setStates((s) => ({
        ...s,
        [widget.id]: { ...emptyState(fetchedSet), ...entry },
      }));
    } catch (e) {
      if (!isCurrent()) return;
      setStates((s) => ({
        ...s,
        [widget.id]: {
          ...s[widget.id],
          loading: false,
          error: (e as Error).message,
        },
      }));
    }
  }, []);

  const refreshAll = useCallback(() => {
    widgets.forEach((w) => runWidget(w));
  }, [runWidget]);

  // After a row action the cached rows are known to be outdated. Dropping them
  // first means that they are refetched on the next mount even if the refetch
  // fails, is cut short by a reload, or cannot start because we are unmounted.
  const refreshAfterAction = useCallback(
    async (widget: Widget<SearchIssue[]>) => {
      clearCache(widget.id);
      if (currentCtx.current) {
        await runWidget(widget);
      } else {
        // No viewer yet: without data, the effect below fetches once there is.
        setStates((s) => ({
          ...s,
          [widget.id]: emptyState(s[widget.id].pinnedSet),
        }));
      }
    },
    [runWidget],
  );

  // Auto-fetch widgets that have no data for the current pinned set, once the
  // viewer is ready and whenever the set changes.
  useEffect(() => {
    if (!viewer) return;
    widgets.forEach((w) => {
      const state = states[w.id];
      if (state.pinnedSet !== pinnedSet || state.data === null) runWidget(w);
    });
    // We intentionally depend only on viewer identity / the pinned set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, pinnedSet]);

  if (viewerError) {
    return (
      <div className="dashboard-empty">
        Could not load viewer: {viewerError}
      </div>
    );
  }
  if (pinnedRepos.length === 0) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty-title">No pinned repos yet</div>
        <div className="dashboard-empty-body">
          Pin repos from the selector above. Widgets aggregate across every
          pinned repo.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-title">Dashboard</div>
          <div className="dashboard-sub">
            {pinnedRepos.length} pinned repo
            {pinnedRepos.length === 1 ? '' : 's'}
            {viewer ? ` · ${viewer.login}` : ''}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={refreshAll}
          disabled={!viewer}
        >
          ↻ Refresh all
        </button>
      </div>
      <div className="dashboard-grid">
        {widgets.map((w) => {
          // Never show data from another pinned set as if it were current.
          const state =
            states[w.id].pinnedSet === pinnedSet
              ? states[w.id]
              : emptyState(pinnedSet);
          const isEmpty =
            state.data !== null && (w.empty ? w.empty(state.data) : false);
          return (
            <section key={w.id} className="widget">
              <header className="widget-header">
                <div>
                  <div className="widget-title">{w.title}</div>
                  {w.description && (
                    <div className="widget-desc">{w.description}</div>
                  )}
                </div>
                <div className="widget-meta">
                  {state.fetchedAt && (
                    <span className="widget-fetched">
                      {formatRelative(state.fetchedAt)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!viewer || state.loading}
                    onClick={() => runWidget(w)}
                  >
                    {state.loading ? '…' : '↻'}
                  </button>
                </div>
              </header>
              <div className="widget-body">
                {state.error && (
                  <div className="widget-error">{state.error}</div>
                )}
                {state.data === null && !state.error && (
                  <div className="widget-placeholder">
                    {state.loading ? 'Loading…' : 'No data yet.'}
                  </div>
                )}
                {state.data !== null && isEmpty && (
                  <div className="widget-placeholder">Nothing to show.</div>
                )}
                {state.data !== null &&
                  !isEmpty &&
                  w.render(state.data, {
                    api,
                    viewer: viewer!,
                    pinnedRepos,
                    refresh: () => refreshAfterAction(w),
                  })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
