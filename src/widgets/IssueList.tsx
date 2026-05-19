import type { SearchIssue } from '../types/github';
import { repoFromUrl } from './types';

interface IssueListProps {
  items: SearchIssue[];
  highlightStaleDays?: number;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function IssueList({ items, highlightStaleDays }: IssueListProps) {
  return (
    <ul className="widget-issue-list">
      {items.map((it) => {
        const repo = repoFromUrl(it.repository_url);
        const isPr = !!it.pull_request;
        const age = daysSince(it.updated_at);
        const stale =
          highlightStaleDays !== undefined && age >= highlightStaleDays;
        return (
          <li key={it.html_url} className="widget-issue-row">
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
          </li>
        );
      })}
    </ul>
  );
}
