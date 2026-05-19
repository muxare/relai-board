import { usePinnedRepos } from '../storage/usePinnedRepos';
import { unpinRepo } from '../storage/pinnedRepos';

interface PinnedSidebarProps {
  currentRepo: string;
  onSelect: (repo: string) => void;
}

export function PinnedSidebar({ currentRepo, onSelect }: PinnedSidebarProps) {
  const pinned = usePinnedRepos();

  return (
    <aside className="pinned-sidebar">
      <div className="pinned-sidebar-header">Pinned repos</div>
      {pinned.length === 0 ? (
        <div className="pinned-sidebar-empty">
          Pin repos from the selector above to see them here.
        </div>
      ) : (
        <ul className="pinned-sidebar-list">
          {pinned.map((name) => {
            const active = name === currentRepo;
            const [owner, repo] = name.split('/');
            return (
              <li
                key={name}
                className={`pinned-sidebar-item ${active ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="pinned-sidebar-link"
                  onClick={() => onSelect(name)}
                  title={name}
                >
                  <span className="pinned-sidebar-owner">{owner}/</span>
                  <span className="pinned-sidebar-repo">{repo}</span>
                </button>
                <button
                  type="button"
                  className="pinned-sidebar-unpin"
                  title="Unpin"
                  aria-label={`Unpin ${name}`}
                  onClick={() => unpinRepo(name)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
