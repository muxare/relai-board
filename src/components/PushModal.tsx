import { useState } from 'react';
import type { TreeNode } from '../types/github';
import type { GitHubAPI } from '../api/github';
import { Pill } from './Pill';

interface PushResult {
  title: string;
  number?: number;
  type: string;
  ok?: boolean;
  error?: string;
}

interface PushModalProps {
  items: TreeNode[];
  api: GitHubAPI;
  milestoneMap: Record<string, number>;
  onDone: () => void;
  onClose: () => void;
}

export function PushModal({
  items,
  api,
  milestoneMap,
  onDone,
  onClose,
}: PushModalProps) {
  const [progress, setProgress] = useState({
    phase: 'preparing',
    current: 0,
    total: 0,
  });
  const [results, setResults] = useState<PushResult[]>([]);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState(false);

  const modified = items.filter((i) => i._modified && i.number);
  const newItems = items.filter((i) => i._new);

  const startPush = async () => {
    setPushing(true);
    const res: PushResult[] = [];

    // Push modifications
    setProgress({ phase: 'updating', current: 0, total: modified.length });
    for (let i = 0; i < modified.length; i++) {
      const item = modified[i];
      try {
        const updates = {
          title: item.title,
          body: item.body,
          labels: item.labelNames,
          state: item.state,
        };
        await api.updateIssue(item.number, updates);
        res.push({
          title: item.title,
          number: item.number,
          type: item.type,
          ok: true,
        });
      } catch (err) {
        res.push({
          title: item.title,
          number: item.number,
          type: item.type,
          error: (err as Error).message,
        });
      }
      setProgress({
        phase: 'updating',
        current: i + 1,
        total: modified.length,
      });
    }

    // Push new issues
    setProgress({ phase: 'creating', current: 0, total: newItems.length });
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      try {
        const ms =
          item.milestone &&
          milestoneMap[
            typeof item.milestone === 'object'
              ? item.milestone.title
              : String(item.milestone)
          ];
        const data = await api.createIssue(
          item.title,
          item.body || '',
          item.labelNames,
          ms || undefined,
        );
        res.push({
          title: item.title,
          number: data.number,
          type: item.type,
          ok: true,
        });
      } catch (err) {
        res.push({
          title: item.title,
          type: item.type,
          error: (err as Error).message,
        });
      }
      setProgress({
        phase: 'creating',
        current: i + 1,
        total: newItems.length,
      });
    }

    setResults(res);
    setDone(true);
    setPushing(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Sync changes to GitHub</h3>
        {!done && !pushing && (
          <>
            <div
              style={{
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--fg2)',
                lineHeight: 1.6,
              }}
            >
              {modified.length > 0 && (
                <div>
                  {modified.length} issue
                  {modified.length > 1 ? 's' : ''} to update
                </div>
              )}
              {newItems.length > 0 && (
                <div>
                  {newItems.length} new issue
                  {newItems.length > 1 ? 's' : ''} to create
                </div>
              )}
              {modified.length === 0 && newItems.length === 0 && (
                <div>No changes to sync.</div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={modified.length + newItems.length === 0}
                onClick={startPush}
              >
                Push changes
              </button>
            </div>
          </>
        )}
        {pushing && (
          <>
            <div
              style={{
                fontSize: 13,
                marginBottom: 8,
                textTransform: 'capitalize',
              }}
            >
              {progress.phase}... {progress.current}/{progress.total}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: progress.total
                    ? `${(progress.current / progress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </>
        )}
        {done && (
          <>
            <div
              style={{
                fontSize: 13,
                color: 'var(--fg2)',
                marginBottom: 12,
              }}
            >
              {results.filter((r) => r.ok).length} of {results.length}{' '}
              operations succeeded.
            </div>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '4px 0',
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    color: r.error ? 'var(--red)' : 'var(--green)',
                    width: 16,
                  }}
                >
                  {r.error ? '✕' : '✓'}
                </span>
                <Pill label={r.type} />
                <span style={{ flex: 1 }}>{r.title}</span>
                {r.number && (
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: 'var(--fg3)',
                    }}
                  >
                    #{r.number}
                  </span>
                )}
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() => {
                  onDone();
                  onClose();
                }}
              >
                Done — reload board
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
