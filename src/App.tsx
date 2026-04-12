import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { TreeNode as TreeNodeType } from './types/github';
import { GitHubAPI } from './api/github';
import { getLabelStyle } from './labels/styles';
import { parseIssuesToTree } from './parse/tree';
import { parseMarkdown } from './parse/markdown';
import { TreeNode } from './components/TreeNode';
import { ConnectScreen } from './components/ConnectScreen';
import { EditModal } from './components/EditModal';
import { PushModal } from './components/PushModal';
import { OAUTH_WORKER_URL } from './config';

const SESSION_KEY = 'relai-board:session';

function App() {
  const [connected, setConnected] = useState(false);
  const [repo, setRepo] = useState('');
  const [tree, setTree] = useState<TreeNodeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('board');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editItem, setEditItem] = useState<TreeNodeType | null>(null);
  const [showPush, setShowPush] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [milestoneMap, setMilestoneMap] = useState<Record<string, number>>(
    {},
  );
  const [error, setError] = useState('');
  const [oauthToken, setOauthToken] = useState<string | null>(null);
  const apiRef = useRef<GitHubAPI | null>(null);

  // Handle OAuth callback — exchange code for token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    window.history.replaceState({}, '', window.location.pathname);
    fetch(OAUTH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data: { access_token?: string }) => {
        if (data.access_token) setOauthToken(data.access_token);
      })
      .catch(console.error);
  }, []);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { repo: r, token: t } = JSON.parse(saved) as {
          repo: string;
          token: string;
        };
        if (r && t) {
          setRepo(r);
          setConnected(true);
          apiRef.current = new GitHubAPI(t, r);
          loadBoard(new GitHubAPI(t, r));
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const handleConnect = (r: string, t: string) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ repo: r, token: t }));
    setRepo(r);
    setConnected(true);
    apiRef.current = new GitHubAPI(t, r);
    loadBoard(new GitHubAPI(t, r));
  };

  const loadBoard = async (api: GitHubAPI) => {
    setLoading(true);
    setError('');
    try {
      const [issues, milestones] = await Promise.all([
        api.getIssues(),
        api.getMilestones(),
      ]);
      const msMap: Record<string, number> = {};
      milestones.forEach((m) => {
        msMap[m.title] = m.number;
      });
      setMilestoneMap(msMap);
      const parsed = parseIssuesToTree(issues);
      setTree(parsed);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handleToggle = useCallback((key: string) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  }, []);

  const handleOpen = (item: TreeNodeType) => {
    if (item.html_url) window.open(item.html_url, '_blank');
  };

  const handleEdit = (item: TreeNodeType) => setEditItem(item);

  const handleSave = (updated: TreeNodeType) => {
    function updateInTree(nodes: TreeNodeType[]): TreeNodeType[] {
      return nodes.map((n) => {
        if (n.number === updated.number) return { ...n, ...updated };
        if (n.children)
          return { ...n, children: updateInTree(n.children) };
        return n;
      });
    }
    setTree((prev) => updateInTree(prev));
    setEditItem(null);
  };

  const handleAddFromMarkdown = () => {
    const parsed = parseMarkdown(markdown);
    async function pushAll() {
      const api = apiRef.current!;
      setLoading(true);
      // Ensure labels exist
      const allLabels = new Set<string>();
      function collectLabels(
        items: ReturnType<typeof parseMarkdown>,
      ) {
        items.forEach((i) => {
          (i.labels || []).forEach((l) => allLabels.add(l));
          if (i.children) collectLabels(i.children);
        });
      }
      collectLabels(parsed);
      for (const label of allLabels) {
        const s = getLabelStyle(label);
        try {
          await api.createLabel(label, s.ghColor);
        } catch {
          /* label may already exist */
        }
      }
      // Ensure milestones
      const milestones = new Set<string>();
      function collectMs(
        items: ReturnType<typeof parseMarkdown>,
      ) {
        items.forEach((i) => {
          if (i.milestone) milestones.add(i.milestone);
          if (i.children) collectMs(i.children);
        });
      }
      collectMs(parsed);
      const msMap = { ...milestoneMap };
      for (const ms of milestones) {
        if (!msMap[ms]) {
          try {
            const data = await api.createMilestone(ms);
            msMap[ms] = data.number;
          } catch {
            /* milestone may already exist */
          }
        }
      }
      setMilestoneMap(msMap);
      // Create issues top-down
      async function createTree(
        items: ReturnType<typeof parseMarkdown>,
        parentNumber: number | null,
      ) {
        for (const item of items) {
          let body = item.body || '';
          if (parentNumber) body = `Parent: #${parentNumber}\n\n${body}`;
          const prefix =
            item.type === 'epic'
              ? 'Epic'
              : item.type === 'feature'
                ? 'Feature'
                : 'Story';
          try {
            const data = await api.createIssue(
              `${prefix}: ${item.title}`,
              body,
              item.labels,
              msMap[item.milestone] || undefined,
            );
            if (item.children && item.children.length > 0)
              await createTree(item.children, data.number);
          } catch (err) {
            console.error('Failed:', item.title, err);
          }
        }
      }
      await createTree(parsed, null);
      setMarkdown('');
      await loadBoard(api);
    }
    pushAll();
  };

  const allItems = useMemo(() => {
    function collectItems(nodes: TreeNodeType[]): TreeNodeType[] {
      let items: TreeNodeType[] = [];
      for (const n of nodes) {
        items.push(n);
        if (n.children) items = items.concat(collectItems(n.children));
      }
      return items;
    }
    return collectItems(tree);
  }, [tree]);
  const modifiedCount = allItems.filter(
    (i) => i._modified || i._new,
  ).length;

  const counts = useMemo(() => {
    let e = 0,
      f = 0,
      s = 0;
    allItems.forEach((i) => {
      if (i.type === 'epic') e++;
      else if (i.type === 'feature') f++;
      else if (i.type === 'story') s++;
    });
    return { epics: e, features: f, stories: s, total: allItems.length };
  }, [allItems]);

  if (!connected) return <ConnectScreen onConnect={handleConnect} oauthToken={oauthToken} />;

  return (
    <div className="app">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-logo">
          <span>R</span>
          <span>I</span>
          <span style={{ fontWeight: 500, fontSize: 15, marginLeft: 4 }}>
            Board
          </span>
        </div>
        <span className="topbar-repo">{repo}</span>
        <div className="topbar-spacer" />
        <div className="topbar-stats">
          <span>{counts.epics} epics</span>
          <span>{counts.features} features</span>
          <span>{counts.stories} stories</span>
        </div>
        {modifiedCount > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowPush(true)}
          >
            Sync {modifiedCount} change{modifiedCount > 1 ? 's' : ''}
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={() => loadBoard(apiRef.current!)}
        >
          ↻ Refresh
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY);
            setConnected(false);
            setTree([]);
          }}
        >
          Disconnect
        </button>
      </div>
      {/* Tabs */}
      <div className="tabs">
        {['board', 'add issues', 'markdown import'].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {/* Main content */}
      <div className="main">
        {loading && (
          <div
            style={{ padding: 40, textAlign: 'center', color: 'var(--fg3)' }}
          >
            Loading issues...
          </div>
        )}
        {error && (
          <div style={{ padding: 20, color: 'var(--red)', fontSize: 13 }}>
            {error}
          </div>
        )}
        {!loading && tab === 'board' && (
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {tree.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: 'var(--fg3)',
                  fontSize: 14,
                }}
              >
                No issues found. Use &quot;Markdown import&quot; to create your
                first issues.
              </div>
            ) : (
              tree.map((item, i) => (
                <TreeNode
                  key={item.number || i}
                  item={item}
                  depth={0}
                  expanded={expanded}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onOpen={handleOpen}
                />
              ))
            )}
          </div>
        )}
        {!loading && tab === 'add issues' && (
          <div className="panel">
            <div
              style={{
                marginBottom: 12,
                fontSize: 13,
                color: 'var(--fg2)',
                lineHeight: 1.6,
              }}
            >
              Click &quot;Edit&quot; on any issue in the board tab to modify it,
              then use &quot;Sync&quot; to push changes to GitHub.
            </div>
            <div
              style={{
                padding: 24,
                background: 'var(--bg2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✎</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Edit issues directly from the board
              </div>
              <div
                style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 4 }}
              >
                Hover over any issue and click &quot;Edit&quot; to modify
                titles, labels, body, or state. Modified issues show an orange
                badge and can be synced.
              </div>
            </div>
          </div>
        )}
        {!loading && tab === 'markdown import' && (
          <div className="panel">
            <div
              style={{
                marginBottom: 8,
                fontSize: 12,
                color: 'var(--fg2)',
                lineHeight: 1.6,
              }}
            >
              Paste a markdown plan using{' '}
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  background: 'var(--bg2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                # Epic:
              </code>{' '}
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  background: 'var(--bg2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                ## Feature:
              </code>{' '}
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  background: 'var(--bg2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                ### Story:
              </code>{' '}
              headings with{' '}
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  background: 'var(--bg2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                labels:
              </code>{' '}
              and{' '}
              <code
                style={{
                  fontFamily: 'var(--mono)',
                  background: 'var(--bg2)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                milestone:
              </code>{' '}
              metadata.
            </div>
            <textarea
              className="editor-area"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={
                '# Epic: My Epic\nlabels: epic, phase-1\nmilestone: Phase 1\n---\nDescription of the epic.\n\n## Feature: My Feature\nlabels: feature, phase-1, backend\n---\nDescription.\n\n### Story: My Story\nlabels: story, phase-1\n---\nAcceptance criteria...'
              }
            />
            {markdown && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={handleAddFromMarkdown}
                >
                  Create issues from markdown
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Modals */}
      {editItem && (
        <EditModal
          item={editItem}
          onSave={handleSave}
          onClose={() => setEditItem(null)}
        />
      )}
      {showPush && (
        <PushModal
          items={allItems}
          api={apiRef.current!}
          milestoneMap={milestoneMap}
          onDone={() => loadBoard(apiRef.current!)}
          onClose={() => setShowPush(false)}
        />
      )}
    </div>
  );
}

export default App;
