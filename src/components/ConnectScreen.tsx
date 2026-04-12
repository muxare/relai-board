import { useState } from 'react';
import { GitHubAPI } from '../api/github';
import { GITHUB_CLIENT_ID, OAUTH_REDIRECT_URI } from '../config';

interface ConnectScreenProps {
  onConnect: (repo: string, token: string) => void;
  oauthToken?: string | null;
}

export function ConnectScreen({ onConnect, oauthToken }: ConnectScreenProps) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveToken = oauthToken || token;

  const handleConnect = async () => {
    if (!effectiveToken) return;
    setLoading(true);
    setError('');
    try {
      const api = new GitHubAPI(effectiveToken, repo);
      await api.verifyAccess();
      onConnect(repo, effectiveToken);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handleOAuthLogin = () => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=repo`;
    window.location.href = url;
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

        {oauthToken ? (
          <>
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--bg2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--green, #4caf50)',
                fontSize: 13,
                color: 'var(--green, #4caf50)',
                marginBottom: 16,
              }}
            >
              Authenticated via GitHub
            </div>
            <div className="field">
              <label>Repository</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo"
              />
            </div>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px',
                marginBottom: 16,
              }}
              onClick={handleOAuthLogin}
            >
              Login with GitHub
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                color: 'var(--fg3)',
                fontSize: 12,
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span>or use a token</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

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
          </>
        )}

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
          disabled={loading || !repo || !effectiveToken}
          onClick={handleConnect}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
}
