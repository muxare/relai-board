import type { SearchIssue } from '../types/github';
import { IssueList } from './IssueList';
import { repoFromUrl, type RowAction, type Widget } from './types';

function repoQuery(repos: string[]): string {
  return repos.map((r) => `repo:${r}`).join(' ');
}

function empty(items: SearchIssue[]): boolean {
  return items.length === 0;
}

const approve: RowAction<SearchIssue> = {
  id: 'approve',
  label: '✓ Approve',
  title: 'Approve this PR',
  visible: (row) => !!row.pull_request && row.state === 'open',
  confirm: (row) =>
    `Approve #${row.number} in ${repoFromUrl(row.repository_url)}?`,
  run: (row, ctx) =>
    ctx.api.approvePr(repoFromUrl(row.repository_url), row.number),
};

const mergePr: RowAction<SearchIssue> = {
  id: 'merge',
  label: '⏷ Merge',
  title: 'Squash-merge this PR',
  visible: (row) => !!row.pull_request && row.state === 'open' && !row.draft,
  confirm: (row) =>
    `Squash-merge #${row.number} in ${repoFromUrl(row.repository_url)}?`,
  run: (row, ctx) =>
    ctx.api.mergePr(repoFromUrl(row.repository_url), row.number, 'squash'),
};

const closeIssue: RowAction<SearchIssue> = {
  id: 'close',
  label: '✕ Close',
  title: 'Close this issue',
  visible: (row) => !row.pull_request && row.state === 'open',
  confirm: (row) =>
    `Close #${row.number} in ${repoFromUrl(row.repository_url)}?`,
  run: (row, ctx) =>
    ctx.api.closeIssue(repoFromUrl(row.repository_url), row.number),
};

const prsAwaitingReview: Widget<SearchIssue[]> = {
  id: 'prs-awaiting-review',
  title: 'PRs awaiting your review',
  description:
    'Open PRs across pinned repos where you are a requested reviewer.',
  fetch: async ({ api, pinnedRepos }) => {
    if (pinnedRepos.length === 0) return [];
    return api.searchIssues(
      `is:open is:pr review-requested:@me ${repoQuery(pinnedRepos)}`,
    );
  },
  render: (items, ctx) => (
    <IssueList
      items={items}
      highlightStaleDays={3}
      actions={[approve]}
      ctx={ctx}
    />
  ),
  empty,
};

const yourOpenPrs: Widget<SearchIssue[]> = {
  id: 'your-open-prs',
  title: 'Your open PRs',
  description:
    'Open PRs you authored across pinned repos. Stale > 7 days are flagged.',
  fetch: async ({ api, viewer, pinnedRepos }) => {
    if (pinnedRepos.length === 0) return [];
    return api.searchIssues(
      `is:open is:pr author:${viewer.login} ${repoQuery(pinnedRepos)}`,
    );
  },
  render: (items, ctx) => (
    <IssueList
      items={items}
      highlightStaleDays={7}
      actions={[mergePr]}
      ctx={ctx}
    />
  ),
  empty,
};

const issuesAssignedToYou: Widget<SearchIssue[]> = {
  id: 'issues-assigned',
  title: 'Issues assigned to you',
  description: 'Open issues assigned to you across pinned repos.',
  fetch: async ({ api, viewer, pinnedRepos }) => {
    if (pinnedRepos.length === 0) return [];
    return api.searchIssues(
      `is:open is:issue assignee:${viewer.login} ${repoQuery(pinnedRepos)}`,
    );
  },
  render: (items, ctx) => (
    <IssueList items={items} actions={[closeIssue]} ctx={ctx} />
  ),
  empty,
};

export const widgets: Widget<SearchIssue[]>[] = [
  prsAwaitingReview,
  yourOpenPrs,
  issuesAssignedToYou,
];
