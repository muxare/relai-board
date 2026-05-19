import { useCallback, useEffect, useState } from 'react';
import { GitHubAPI } from '../api/github';
import type { WorkflowInput, WorkflowSummary } from '../types/github';
import { usePinnedRepos } from '../storage/usePinnedRepos';
import { parseWorkflowDispatchInputs } from '../workflows/parseInputs';

interface WorkflowsProps {
  api: GitHubAPI;
}

interface RepoWorkflows {
  repo: string;
  loading: boolean;
  error: string | null;
  workflows: WorkflowSummary[];
}

interface DispatchTarget {
  repo: string;
  workflow: WorkflowSummary;
  inputs: WorkflowInput[];
  defaultBranch: string;
}

export function Workflows({ api }: WorkflowsProps) {
  const pinnedRepos = usePinnedRepos();
  const [byRepo, setByRepo] = useState<Record<string, RepoWorkflows>>({});
  const [target, setTarget] = useState<DispatchTarget | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    setByRepo((prev) => {
      const next: Record<string, RepoWorkflows> = {};
      for (const r of pinnedRepos) {
        next[r] = prev[r] || {
          repo: r,
          loading: false,
          error: null,
          workflows: [],
        };
      }
      return next;
    });
  }, [pinnedRepos]);

  const loadRepo = useCallback(
    async (repo: string) => {
      setByRepo((s) => ({
        ...s,
        [repo]: { ...s[repo], loading: true, error: null },
      }));
      try {
        const all = await api.listWorkflows(repo);
        setByRepo((s) => ({
          ...s,
          [repo]: {
            repo,
            loading: false,
            error: null,
            workflows: all.filter((w) => w.state === 'active'),
          },
        }));
      } catch (e) {
        setByRepo((s) => ({
          ...s,
          [repo]: {
            ...s[repo],
            loading: false,
            error: (e as Error).message,
          },
        }));
      }
    },
    [api],
  );

  useEffect(() => {
    pinnedRepos.forEach((r) => {
      if (byRepo[r] && byRepo[r].workflows.length === 0 && !byRepo[r].loading)
        loadRepo(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedRepos.join(',')]);

  const openLauncher = useCallback(
    async (repo: string, workflow: WorkflowSummary) => {
      const key = `${repo}:${workflow.id}`;
      setOpening(key);
      try {
        const [yaml, defaultBranch] = await Promise.all([
          api.getWorkflowFileContent(repo, workflow.path),
          api.getDefaultBranch(repo),
        ]);
        const inputs = parseWorkflowDispatchInputs(yaml);
        setTarget({ repo, workflow, inputs, defaultBranch });
      } catch (e) {
        setByRepo((s) => ({
          ...s,
          [repo]: { ...s[repo], error: (e as Error).message },
        }));
      } finally {
        setOpening(null);
      }
    },
    [api],
  );

  if (pinnedRepos.length === 0) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty-title">No pinned repos yet</div>
        <div className="dashboard-empty-body">
          Pin some repos first — workflows aggregate across every pinned repo.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-title">Workflows</div>
          <div className="dashboard-sub">
            Dispatch any <code>workflow_dispatch</code> workflow across pinned
            repos.
          </div>
        </div>
      </div>
      <div className="workflow-list">
        {pinnedRepos.map((repo) => {
          const r = byRepo[repo];
          if (!r) return null;
          return (
            <section key={repo} className="widget">
              <header className="widget-header">
                <div>
                  <div className="widget-title">{repo}</div>
                  <div className="widget-desc">
                    {r.loading
                      ? 'Loading…'
                      : `${r.workflows.length} active workflow${
                          r.workflows.length === 1 ? '' : 's'
                        }`}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={r.loading}
                  onClick={() => loadRepo(repo)}
                >
                  ↻
                </button>
              </header>
              <div className="widget-body">
                {r.error && <div className="widget-error">{r.error}</div>}
                {!r.error && r.workflows.length === 0 && !r.loading && (
                  <div className="widget-placeholder">No workflows.</div>
                )}
                <ul className="widget-issue-list">
                  {r.workflows.map((w) => {
                    const key = `${repo}:${w.id}`;
                    return (
                      <li key={w.id} className="widget-issue-row">
                        <span className="widget-issue-link">
                          <span className="widget-issue-title">{w.name}</span>
                          <span className="widget-issue-repo">{w.path}</span>
                        </span>
                        <span className="widget-issue-actions">
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={opening === key}
                            onClick={() => openLauncher(repo, w)}
                          >
                            {opening === key ? '…' : '▶ Run'}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      {target && (
        <DispatchModal
          api={api}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

interface DispatchModalProps {
  api: GitHubAPI;
  target: DispatchTarget;
  onClose: () => void;
}

function DispatchModal({ api, target, onClose }: DispatchModalProps) {
  const [ref, setRef] = useState(target.defaultBranch);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const inp of target.inputs) init[inp.name] = inp.default ?? '';
    return init;
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const setInput = (name: string, v: string) =>
    setValues((s) => ({ ...s, [name]: v }));

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      for (const inp of target.inputs) {
        const v = values[inp.name] ?? '';
        if (v !== '') payload[inp.name] = v;
        else if (inp.required && !inp.default)
          throw new Error(`Input "${inp.name}" is required`);
      }
      await api.dispatchWorkflow(target.repo, target.workflow.id, ref, payload);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Run {target.workflow.name}</div>
            <div className="modal-sub">
              {target.repo} · {target.workflow.path}
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Ref (branch / tag)</label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>
          {target.inputs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg3)' }}>
              No inputs declared.
            </div>
          )}
          {target.inputs.map((inp) => (
            <div className="field" key={inp.name}>
              <label>
                {inp.name}
                {inp.required ? ' *' : ''}
              </label>
              {inp.type === 'choice' && inp.options ? (
                <select
                  value={values[inp.name] ?? ''}
                  onChange={(e) => setInput(inp.name, e.target.value)}
                >
                  {inp.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : inp.type === 'boolean' ? (
                <select
                  value={values[inp.name] ?? 'false'}
                  onChange={(e) => setInput(inp.name, e.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={values[inp.name] ?? ''}
                  placeholder={inp.default || ''}
                  onChange={(e) => setInput(inp.name, e.target.value)}
                />
              )}
              {inp.description && <small>{inp.description}</small>}
            </div>
          ))}
          {error && (
            <div className="widget-error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          {done && (
            <div
              style={{
                marginTop: 12,
                color: 'var(--green, #2ea043)',
                fontSize: 13,
              }}
            >
              ✓ Dispatched. Check the repo's Actions tab.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={running || done}
            onClick={run}
          >
            {running ? 'Dispatching…' : 'Run workflow'}
          </button>
        </div>
      </div>
    </div>
  );
}
