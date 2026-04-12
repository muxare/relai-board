import { describe, it, expect } from 'vitest';
import { parseIssuesToTree } from './tree';
import type { Issue } from '../types/github';

function makeIssue(overrides: Partial<Issue> & { number: number }): Issue {
  return {
    title: `Issue ${overrides.number}`,
    body: null,
    state: 'open',
    labels: [],
    milestone: null,
    html_url: `https://github.com/test/repo/issues/${overrides.number}`,
    ...overrides,
  };
}

describe('parseIssuesToTree', () => {
  it('builds a parent-child tree from Parent: #N references', () => {
    const issues: Issue[] = [
      makeIssue({
        number: 1,
        title: 'Epic: My Epic',
        labels: [{ name: 'epic', color: '6F42C1' }],
      }),
      makeIssue({
        number: 2,
        title: 'Feature: My Feature',
        labels: [{ name: 'feature', color: '0E8A16' }],
        body: 'Parent: #1\n\nSome feature description',
      }),
      makeIssue({
        number: 3,
        title: 'Story: My Story',
        labels: [{ name: 'story', color: '1D76DB' }],
        body: 'Parent: #2\n\nStory details',
      }),
    ];

    const roots = parseIssuesToTree(issues);

    expect(roots).toHaveLength(1);
    expect(roots[0].number).toBe(1);
    expect(roots[0].type).toBe('epic');
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].number).toBe(2);
    expect(roots[0].children[0].type).toBe('feature');
    expect(roots[0].children[0].children).toHaveLength(1);
    expect(roots[0].children[0].children[0].number).toBe(3);
    expect(roots[0].children[0].children[0].type).toBe('story');
  });

  it('filters out pull requests', () => {
    const issues: Issue[] = [
      makeIssue({ number: 1, labels: [{ name: 'epic', color: '6F42C1' }] }),
      makeIssue({
        number: 2,
        labels: [{ name: 'feature', color: '0E8A16' }],
        pull_request: {},
      }),
    ];

    const roots = parseIssuesToTree(issues);
    expect(roots).toHaveLength(1);
    expect(roots[0].number).toBe(1);
  });

  it('treats issues without recognized labels as "other"', () => {
    const issues: Issue[] = [
      makeIssue({
        number: 1,
        labels: [{ name: 'bug', color: 'FF0000' }],
      }),
    ];

    const roots = parseIssuesToTree(issues);
    expect(roots[0].type).toBe('other');
  });
});
