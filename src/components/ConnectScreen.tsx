import { useEffect, useState } from 'react';
import { GITHUB_CLIENT_ID, OAUTH_REDIRECT_URI } from '../config';

interface ConnectScreenProps {
  onConnect: (token: string) => void;
  oauthToken?: string | null;
}

export function ConnectScreen({ onConnect, oauthToken }: ConnectScreenProps) {
  const [token, setToken] = useState('');

  // If OAuth callback completed, hand the token to the parent immediately.
  useEffect(() => {
    if (oauthToken) onConnect(oauthToken);
  }, [oauthToken, onConnect]);

  const handleOAuthLogin = () => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=repo`;
    window.location.href = url;
  };

  const handlePatConnect = () => {
    if (!token) return;
    onConnect(token);
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
          Connect to GitHub to manage epics, features, and stories as issues
          with a hierarchical board.
        </p>

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
          <label>Personal access token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
          />
          <small>
            Needs Issues read/write scope. Stored in session only — cleared when
            you close the tab.
          </small>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          disabled={!token}
          onClick={handlePatConnect}
        >
          Connect
        </button>
      </div>
    </div>
  );
}
