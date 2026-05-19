# Searchable Repo Dropdown

## Summary

Replace the static repo display in the topbar with a searchable dropdown that lets users select and switch between GitHub repositories. Remove repo selection from the ConnectScreen so login is auth-only; repo selection happens post-connect via the dropdown.

## User Flow

1. User logs in via OAuth or PAT on ConnectScreen (no repo field).
2. App shows topbar with "RI Board" logo + repo dropdown (placeholder: "Select a repository...").
3. Main area shows empty state: "Select a repository to get started".
4. User clicks dropdown — shows recent repos at top, then all user repos fetched from GitHub API.
5. User types to filter — filters local list + debounced API search.
6. User selects repo — board loads.
7. Switching repo with unsaved changes — confirmation dialog before switching.

## Component: `RepoSelector`

**File:** `src/components/RepoSelector.tsx`

**Placement:** In the topbar, replacing the current static `<span className="topbar-repo">{repo}</span>`.

**Props:**

```ts
interface RepoSelectorProps {
  currentRepo: string;        // "" when no repo selected
  token: string;
  onSelect: (repo: string) => void;
  hasUnsavedChanges: boolean;
}
```

### Visual Design

- Rounded pill-shaped input in the topbar, monospace font, matching the current `topbar-repo` styling.
- Displays `owner/repo` when a repo is selected, placeholder text otherwise.
- Click opens a dropdown panel anchored below the input.
- Dropdown contains a search input at the top and a scrollable list below.
- List is divided into sections with headers: "Recent" and "All repositories".
- Clicking outside or pressing Escape closes the dropdown.
- Selected/hovered item has a subtle highlight.

### Keyboard Navigation

- Arrow Up/Down to navigate list items.
- Enter to select the highlighted item.
- Escape to close the dropdown.
- Typing filters the list in real time.

## Data Sources

### Recent Repos

- Stored in `localStorage` with key `relai-board:recent-repos`.
- JSON array of strings (`["owner/repo", ...]`), max 10 entries, most-recent-first.
- Updated whenever a repo is selected (moved to front, duplicates removed, trimmed to 10).

### GitHub API

- **On dropdown open:** Fetch user repos via `GET /user/repos?per_page=100&sort=updated`. Cached in component state for the session (re-fetched on next dropdown open only if stale).
- **On search input (debounced 300ms):** If the typed query doesn't match enough cached results, search via `GET /search/repositories?q={query}+user:@me` to find repos beyond the first 100.

## GitHub API Additions

**File:** `src/api/github.ts`

New type:

```ts
export interface Repo {
  full_name: string;
  description: string | null;
  private: boolean;
}
```

New methods on `GitHubAPI` (these use the base `https://api.github.com` URL, not the repo-scoped URL):

```ts
// Fetch authenticated user's repos, sorted by last updated
async getUserRepos(): Promise<Repo[]>

// Search repos accessible to the user
async searchRepos(query: string): Promise<Repo[]>
```

These methods must work without a repo being set on the API instance, since they're called before repo selection. This means they use the base GitHub API URL directly rather than the repo-scoped `baseUrl`.

## ConnectScreen Changes

**File:** `src/components/ConnectScreen.tsx`

- Remove the repo input field entirely.
- Keep "Login with GitHub" button and PAT input.
- `onConnect` callback signature changes from `(repo: string, token: string)` to `(token: string)`.
- On successful auth (OAuth callback or PAT entry), set token and transition to the connected state without loading a board.

## App.tsx State Changes

**File:** `src/App.tsx`

### State Model

The concept of "connected" splits into two concerns:

- **Authenticated:** has a valid token (shows topbar + repo selector).
- **Repo selected:** has a repo chosen (loads and shows the board).

```
Not authenticated  -->  Authenticated, no repo  -->  Authenticated + repo selected
(ConnectScreen)         (empty board + prompt)       (full board)
```

### Specific Changes

- `handleConnect(token: string)` — only sets token + connected state. Does not load board.
- New `handleRepoSelect(repo: string)`:
  - If `hasUnsavedChanges`, show `window.confirm()` dialog. Abort if cancelled.
  - Update `repo` state.
  - Create new `GitHubAPI` instance with the token and selected repo.
  - Save to recent repos in localStorage.
  - Save session to sessionStorage (existing `SESSION_KEY`).
  - Call `loadBoard()`.
- Session restore (existing `useEffect`): if session has both token and repo, restore both. If session has only token, restore authenticated state without repo.
- The topbar stats, sync button, refresh button, and tabs only render when a repo is selected.
- When authenticated but no repo selected, main area shows: "Select a repository to get started".

### Unsaved Changes Check

The existing `modifiedCount` derived value is used: `hasUnsavedChanges = modifiedCount > 0`.

When switching repos with unsaved changes:

```ts
if (hasUnsavedChanges) {
  const ok = window.confirm(
    'You have unsaved changes. Switch repository and discard them?'
  );
  if (!ok) return;
}
```

## Styling

**File:** `src/styles.css`

New styles for the repo selector dropdown:

- `.repo-selector` — container with relative positioning.
- `.repo-selector-trigger` — the clickable pill (inherits from existing `topbar-repo` style).
- `.repo-selector-dropdown` — absolute-positioned panel below trigger, with background, border, shadow, border-radius matching existing modal styling.
- `.repo-selector-search` — search input at top of dropdown.
- `.repo-selector-section` — section header ("Recent", "All repositories").
- `.repo-selector-item` — individual repo row, with hover/focus highlight.
- `.repo-selector-item.selected` — currently active repo highlight.

## Files Changed

| File | Change |
|------|--------|
| `src/components/RepoSelector.tsx` | New component |
| `src/components/ConnectScreen.tsx` | Remove repo input, simplify `onConnect` signature |
| `src/api/github.ts` | Add `Repo` type, `getUserRepos()`, `searchRepos()` methods |
| `src/types/github.ts` | Add `Repo` interface |
| `src/App.tsx` | Split connected/repo-selected state, add `handleRepoSelect`, wire `RepoSelector` |
| `src/styles.css` | Add repo selector dropdown styles |

## Out of Scope

- Dashboard/landing page showing issues across repos (future feature).
- Org-level repo browsing (only user's accessible repos).
- Repo favoriting/pinning beyond recent history.
- Disconnect per-repo (disconnect clears the entire session).
