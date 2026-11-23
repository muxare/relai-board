import { useEffect, useState } from 'react';
import type { SearchIssue } from '../types/github';
import { repoFromUrl } from './types';
import type { RowAction, WidgetRenderContext } from './types';

interface IssueListProps {
  items: SearchIssue[];
  highlightStaleDays?: number;
  actions?: RowAction<SearchIssue>[];
  ctx?: WidgetRenderContext;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function IssueList({
  items,
  highlightStaleDays,
  actions,
  ctx,
}: IssueListProps) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  // Forget errors of rows that are gone, so a row that returns starts clean.
  useEffect(() => {
    setError((prev) => {
      const kept = Object.entries(prev).filter(([k]) =>
        items.some((it) => k.startsWith(`${it.html_url}:`)),
      );
      return kept.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(kept);
    });
  }, [items]);

  async function runAction(action: RowAction<SearchIssue>, row: SearchIssue) {
    if (!ctx) return;
    if (action.confirm && !window.confirm(action.confirm(row))) return;
    const key = `${row.html_url}:${action.id}`;
    setBusy((b) => ({ ...b, [key]: true }));
    setError((e) => ({ ...e, [key]: '' }));
    try {
      await action.run(row, ctx);
      // Stay busy until the refetch is done, so that the action cannot be fired
      // again on a row that is about to disappear.
      await ctx.refresh();
    } catch (e) {
      setError((s) => ({ ...s, [key]: (e as Error).message }));
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }

  return (
    <ul className="widget-issue-list">
      {items.map((it) => {
        const repo = repoFromUrl(it.repository_url);
        const isPr = !!it.pull_request;
        const age = daysSince(it.updated_at);
        const stale =
          highlightStaleDays !== undefined && age >= highlightStaleDays;
        const rowKey = it.html_url;
        const visibleActions =
          actions && ctx
            ? actions.filter((a) => (a.visible ? a.visible(it, ctx) : true))
            : [];
        const rowError = Object.entries(error).find(
          ([k, v]) => k.startsWith(`${rowKey}:`) && v,
        );
        return (
          <li key={rowKey} className="widget-issue-row">
            <a
              className="widget-issue-link"
              href={it.html_url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="widget-issue-repo">{repo}</span>
              <span className="widget-issue-num">
                #{it.number}
                {isPr && it.draft ? ' (draft)' : ''}
              </span>
              <span className="widget-issue-title">{it.title}</span>
            </a>
            <span
              className={`widget-issue-age${stale ? ' stale' : ''}`}
              title={`Updated ${it.updated_at}`}
            >
              {age === 0 ? 'today' : `${age}d`}
            </span>
            {visibleActions.length > 0 && (
              <span className="widget-issue-actions">
                {visibleActions.map((a) => {
                  const key = `${rowKey}:${a.id}`;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="btn btn-xs"
                      title={a.title || a.label}
                      disabled={!!busy[key]}
                      onClick={() => runAction(a, it)}
                    >
                      {busy[key] ? '…' : a.label}
                    </button>
                  );
                })}
              </span>
            )}
            {rowError && (
              <span className="widget-issue-error" title={rowError[1]}>
                ⚠
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
