import type { SearchIssue } from '../types/github';
import { IssueList } from './IssueList';
import type { Widget } from './types';

function repoQuery(repos: string[]): string {
  return repos.map((r) => `repo:${r}`).join(' ');
}

function empty(items: SearchIssue[]): boolean {
  return items.length === 0;
}

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
  render: (items) => <IssueList items={items} highlightStaleDays={3} />,
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
  render: (items) => <IssueList items={items} highlightStaleDays={7} />,
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
  render: (items) => <IssueList items={items} />,
  empty,
};

export const widgets: Widget<SearchIssue[]>[] = [
  prsAwaitingReview,
  yourOpenPrs,
  issuesAssignedToYou,
];
