import { useState } from 'react';
import { GitHubAPI } from '../api/github';

interface ConnectScreenProps {
  onConnect: (repo: string, token: string) => void;
}

export function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const api = new GitHubAPI(token, repo);
      await api.verifyAccess();
      onConnect(repo, token);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700 }}>R</span>
          <span
            style={{ fontSize: 24, fontWeight: 300, color: 'var(--accent)' }}
          >
            I
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, marginLeft: 4 }}>
            Board
          </span>
        </div>
        <p>
          Connect to a GitHub repository to manage epics, features, and stories
          as issues with a hierarchical board.
        </p>
        <div className="field">
          <label>Repository</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo"
          />
        </div>
        <div className="field">
          <label>Personal access token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
          />
          <small>Needs Issues read/write scope. Stored in session only — cleared when you close the tab.</small>
        </div>
        {error && (
          <div
            style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}
          >
            {error}
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          disabled={loading || !repo || !token}
          onClick={handleConnect}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
