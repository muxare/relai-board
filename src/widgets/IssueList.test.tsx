import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GitHubAPI } from '../api/github';
import type { SearchIssue } from '../types/github';
import { IssueList } from './IssueList';
import type { RowAction } from './types';

const row: SearchIssue = {
  number: 1,
  title: 'Row one',
  state: 'open',
  html_url: 'https://github.com/o/a/issues/1',
  repository_url: 'https://api.github.com/repos/o/a',
  updated_at: '2026-11-20T00:00:00Z',
  created_at: '2026-11-20T00:00:00Z',
  user: null,
  labels: [],
};

const ctx = {
  api: {} as GitHubAPI,
  viewer: { login: 'me', avatar_url: '', name: null },
  pinnedRepos: ['o/a'],
  refresh: () => Promise.resolve(),
};

const failing: RowAction<SearchIssue> = {
  id: 'fail',
  label: 'Fail',
  run: () => Promise.reject(new Error('nope')),
};

async function failOnce(items: SearchIssue[]) {
  const result = render(
    <IssueList items={items} actions={[failing]} ctx={ctx} />,
  );
  await act(async () => {
    fireEvent.click(screen.getByText('Fail'));
  });
  expect(screen.getByTitle('nope')).toBeTruthy();
  return (next: SearchIssue[]) =>
    result.rerender(<IssueList items={next} actions={[failing]} ctx={ctx} />);
}

describe('IssueList row state', () => {
  it('keeps a row error across a refetch that still has the row', async () => {
    const rerender = await failOnce([row]);
    rerender([{ ...row }]);
    expect(screen.getByTitle('nope')).toBeTruthy();
  });

  it('forgets a row error once the row has disappeared', async () => {
    const rerender = await failOnce([row]);
    rerender([]);
    rerender([row]);
    expect(screen.queryByTitle('nope')).toBeNull();
  });
});
