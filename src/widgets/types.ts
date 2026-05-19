import type { ReactNode } from 'react';
import type { GitHubAPI } from '../api/github';
import type { SearchIssue, Viewer } from '../types/github';

export interface WidgetContext {
  api: GitHubAPI;
  viewer: Viewer;
  pinnedRepos: string[];
}

export interface RowAction<TRow> {
  id: string;
  label: string;
  title?: string;
  /** Optional predicate; row hides this action when it returns false. */
  visible?: (row: TRow, ctx: WidgetContext) => boolean;
  /** Optional confirm prompt shown before running. */
  confirm?: (row: TRow) => string;
  run: (row: TRow, ctx: WidgetContext) => Promise<void>;
}

export interface Widget<TData> {
  id: string;
  title: string;
  description?: string;
  fetch: (ctx: WidgetContext) => Promise<TData>;
  render: (data: TData, ctx: WidgetContext) => ReactNode;
  empty?: (data: TData) => boolean;
}

export function repoFromUrl(repository_url: string): string {
  return repository_url.replace('https://api.github.com/repos/', '');
}

export function searchIssueRows(items: SearchIssue[]): SearchIssue[] {
  return items.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
