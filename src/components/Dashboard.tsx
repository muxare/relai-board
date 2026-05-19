import { useCallback, useEffect, useState } from 'react';
import { GitHubAPI } from '../api/github';
import type { SearchIssue, Viewer } from '../types/github';
import { usePinnedRepos } from '../storage/usePinnedRepos';
import { readCache, writeCache } from '../storage/widgetCache';
import { widgets } from '../widgets/registry';
import type { Widget, WidgetContext } from '../widgets/types';

interface DashboardProps {
  api: GitHubAPI;
}

interface WidgetState {
  data: SearchIssue[] | null;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

const initialState: WidgetState = {
  data: null,
  fetchedAt: null,
  loading: false,
  error: null,
};

function formatRelative(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function Dashboard({ api }: DashboardProps) {
  const pinnedRepos = usePinnedRepos();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [states, setStates] = useState<Record<string, WidgetState>>(() => {
    const initial: Record<string, WidgetState> = {};
    for (const w of widgets) {
      const cached = readCache<SearchIssue[]>(w.id);
      initial[w.id] = cached
        ? { ...initialState, data: cached.data, fetchedAt: cached.fetchedAt }
        : { ...initialState };
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

  const runWidget = useCallback(
    async (widget: Widget<SearchIssue[]>, ctx: WidgetContext) => {
      setStates((s) => ({
        ...s,
        [widget.id]: { ...s[widget.id], loading: true, error: null },
      }));
      try {
        const data = await widget.fetch(ctx);
        const entry = writeCache(widget.id, data);
        setStates((s) => ({
          ...s,
          [widget.id]: {
            data,
            fetchedAt: entry.fetchedAt,
            loading: false,
            error: null,
          },
        }));
      } catch (e) {
        setStates((s) => ({
          ...s,
          [widget.id]: {
            ...s[widget.id],
            loading: false,
            error: (e as Error).message,
          },
        }));
      }
    },
    [],
  );

  const refreshAll = useCallback(() => {
    if (!viewer) return;
    const ctx: WidgetContext = { api, viewer, pinnedRepos };
    widgets.forEach((w) => runWidget(w, ctx));
  }, [api, viewer, pinnedRepos, runWidget]);

  // Auto-fetch widgets that have no cached data once viewer + pinned are ready.
  useEffect(() => {
    if (!viewer) return;
    const ctx: WidgetContext = { api, viewer, pinnedRepos };
    widgets.forEach((w) => {
      if (states[w.id].data === null) runWidget(w, ctx);
    });
    // We intentionally depend only on viewer / pinnedRepos identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, pinnedRepos.join(',')]);

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
          const state = states[w.id];
          const ctx: WidgetContext | null = viewer
            ? { api, viewer, pinnedRepos }
            : null;
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
                    disabled={!ctx || state.loading}
                    onClick={() => ctx && runWidget(w, ctx)}
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
                  })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
