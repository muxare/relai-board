# relai-board: next phase plan

## Context

`relai-board` is a static GitHub Pages app at https://muxare.github.io/relai-board/ that manages GitHub issues as hierarchical epics → features → stories. It currently lives entirely in a single `index.html` (~700 lines) using React 18 via UMD CDN, no build step, no TypeScript. The PAT is held in-memory only. Hierarchy is encoded by labels (`epic`/`feature`/`story`) plus a literal `Parent: #N` line that the markdown importer prepends to issue bodies on creation only — `updateIssue` does not preserve or rewrite it.

The user has approved a **3-step sequenced plan**, each step shipping as its own change:

1. **Security pass** — narrow: only SRI hashes on the React CDN tags. CSP, sanitization, and PAT documentation are explicitly **deferred** (user's choice when offered the full menu).
2. **Vite + React + TypeScript migration** — port the single-file app to a proper build, no behavior changes.
3. **Drag-and-drop reordering + Kanban-by-milestone view** — built on the new TS base.

The intent: ship the trivially-reviewable security win immediately, then migrate so steps 3+ are actually maintainable, then build features on the new base.

---

## Step 1 — SRI hashes on React CDN scripts

**Scope:** Modify only lines 140–141 of `index.html`. Add `integrity="sha384-..."` and `crossorigin="anonymous"` to both React UMD `<script>` tags. Nothing else changes.

**Generate hashes (run before committing):**
```sh
for url in \
  https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js \
  https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js; do
  printf '%s\n  sha384-%s\n' \
    "$url" \
    "$(curl -fsSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)"
done
```
This is the canonical command to re-run on any future React bump. Keep the version pin at `@18.3.1` — jsdelivr's version-pinned URLs are immutable, so SRI + version pin is the right defense; commit-SHA URLs add nothing.

**Resulting tag shape:**
```html
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"
        integrity="sha384-<hash1>"
        crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"
        integrity="sha384-<hash2>"
        crossorigin="anonymous"></script>
```

**Files modified:** `index.html` only (4 lines).

**Verification:**
1. Open `index.html` in a browser, DevTools Console clean of SRI errors, app renders connect screen.
2. Flip one character of one `integrity=` value, reload — app must fail to render. Revert. (Proves SRI is being enforced rather than silently skipped.)

**Explicitly deferred from this step (user's choice):** CSP meta tag, DOMPurify/sanitization, fine-grained PAT documentation in README. These remain on the table for a later pass.

---

## Step 2 — Vite + React + TypeScript migration

**Goal:** Replace the single `index.html` with a Vite project that builds a static site, deployed to Pages via the official GitHub Actions Pages source. **No feature changes** — strict 1:1 port.

### Critical decisions (locked)

- **Pages source:** flip Settings → Pages → Source from "Deploy from a branch" to **"GitHub Actions"** *before* the workflow runs. Use `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`. No `gh-pages` branch, no third-party actions.
- **Vite base path:** `base: '/relai-board/'` in `vite.config.ts`. Required because this is a project page, not a user page — without it, all assets 404 on Pages.
- **HTTP client:** keep hand-rolled `fetch`. Reject `@octokit/rest` (≈35 KB gzipped, unused features). Pull `@octokit/openapi-types` for **type-only** imports where the hand-rolled `Issue`/`Label`/`Milestone` types aren't enough.
- **Strictness:** `tsconfig.json` `"strict": true` from day one. Expect ~10–20 `any` casts at the GitHub API boundary; that's acceptable in this PR.
- **No SRI in the Vite build** — Vite hashes and bundles everything locally; SRI applies to external CDN assets, of which there will be none post-migration.

### Repo layout after migration

```
relai-board/
├── .github/workflows/deploy.yml    # build + Pages deploy
├── .gitignore                       # node_modules, dist
├── index.html                       # Vite entry template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/favicon.svg               # extracted from current data: URI
└── src/
    ├── main.tsx                     # createRoot mount
    ├── App.tsx                      # port of App component (current 503–697)
    ├── styles.css                   # extracted <style> block (current 9–135)
    ├── api/github.ts                # GitHubAPI class (current 147–199)
    ├── types/github.ts              # Issue, Label, Milestone, TreeNode
    ├── parse/tree.ts                # parseIssuesToTree (current 224–249)
    ├── parse/markdown.ts            # parseMarkdown (current 252–294)
    ├── labels/styles.ts             # LABEL_STYLES + getLabelStyle (current 202–221)
    ├── components/
    │   ├── Pill.tsx                 # current 297–300
    │   ├── TreeNode.tsx             # current 302–339
    │   ├── ConnectScreen.tsx        # current 341–380
    │   ├── EditModal.tsx            # current 382–416
    │   └── PushModal.tsx            # current 418–500
    └── test/setup.ts                # vitest + testing-library setup
```

### Dependencies (pin to current latest at implementation time)

Runtime: `react@^18.3.1`, `react-dom@^18.3.1`.
Build/dev: `vite@^5.4`, `@vitejs/plugin-react@^4.3`, `typescript@^5.6`.
Tests: `vitest@^2.1`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `jsdom@^25`.
Lint/format: `eslint@^9`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier@^3.3`.
Types only: `@octokit/openapi-types@^22`.

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `test`, `lint`, `format`.

### Minimal `Issue`/`TreeNode` types (`src/types/github.ts`)

```ts
export interface Label { name: string; color: string; }
export interface Milestone { number: number; title: string; state: 'open' | 'closed'; }
export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Label[];
  milestone: Milestone | null;
  html_url: string;
  pull_request?: unknown;   // presence => filter as PR
}
export type NodeType = 'epic' | 'feature' | 'story' | 'other';
export interface TreeNode extends Issue {
  type: NodeType;
  labelNames: string[];
  parentNumber: number | null;
  children: TreeNode[];
  _synced?: boolean;
  _modified?: boolean;
  _new?: boolean;
}
```
Cast raw `fetch` JSON at the API boundary in `src/api/github.ts`, not throughout the app.

### `vite.config.ts` essentials

```ts
export default defineConfig({
  base: '/relai-board/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' },
});
```

### Deploy workflow `.github/workflows/deploy.yml`

```yaml
name: Deploy to Pages
on:
  push:
    branches: [master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Porting order (one PR, broken into reviewable commits)

1. **Scaffold** — `npm create vite@latest` react-ts template merged into the repo, add `base`, gitignore `dist/` and `node_modules/`.
2. **Styles + types + API** — copy `<style>` into `src/styles.css` verbatim, write `src/types/github.ts`, port `GitHubAPI` class to `src/api/github.ts` with method types.
3. **Parsers + label styles** — `src/parse/tree.ts`, `src/parse/markdown.ts`, `src/labels/styles.ts`.
4. **Components leaf-first** — `Pill`, `TreeNode`, `ConnectScreen`, `EditModal`, `PushModal`. Convert `h(...)`/`createElement` calls to JSX (mechanical, but eyeball each component running in `npm run dev`).
5. **App.tsx** — preserve every state variable, every effect, every handler name. No refactoring in this PR.
6. **Workflow + Pages config** — add `deploy.yml`, flip the Pages source setting in the GitHub UI.
7. **Tests (small, infra-proving only)** — `parse/tree.test.ts` with a 3-issue fixture; `parse/markdown.test.ts` round-tripping a minimal plan. Heavy testing waits until Step 3 where it earns its keep.

### Verification

```sh
npm ci && npm run lint && npm run test && npm run build && npm run preview
```
Then in the browser:
- Connect against a throwaway test repo, load tree, edit a title, push, verify the change on github.com.
- Confirm `npm run preview` serves at `http://localhost:4173/relai-board/` (note the base path) with no 404s.

After merge, the Action runs and `https://muxare.github.io/relai-board/` must load with a clean console.

### Risks
- **Forgetting `base`** → Pages 404s. `npm run preview` reproduces this locally.
- **Pages source not switched to Actions** → first deploy fails with a clear error. Switch the setting first.
- **JSX conversion regressions** in components with inline `style={}` objects — port one at a time, eyeball in dev.

---

## Step 3 — Drag-and-drop reordering + Kanban-by-milestone view

Built on the Vite+TS base from Step 2. **Recommended as two PRs (3a, 3b)** because the metadata-block format change benefits from one round of real-world exposure before DnD lands on top.

### Step 3a — Issue-body metadata block (the format change)

**Why first:** every read and every write must learn the new format before any DnD code can rely on it. Also: today, `parseIssuesToTree` only writes `Parent: #N` on issue *creation* (`createTree`), and `updateIssue` passes `body` through untouched. Step 3a fixes that as a side effect — every write goes through the serializer and re-emits the block, so accidental deletion in GitHub's UI self-heals on the next sync.

**Format** (placed at the very bottom of the issue body, separated by `\n---\n`):
```
<!-- relai-board
parent: #42
sort: 1500
managed: do not edit — relai-board rewrites this block on every sync
-->
```
Bottom placement is intentional: GitHub's issue editor opens with the cursor at the start, so user edits naturally land *above* the block. Unknown keys (`managed:`) are ignored on parse — informational only.

**New file `src/meta/block.ts`:**
```ts
export interface RelaiMeta { parent: number | null; sort: number | null; }
export function parseMeta(body: string | null): { meta: RelaiMeta; bodyWithout: string };
export function serializeMeta(bodyWithout: string, meta: RelaiMeta): string;
```

Rules:
1. `parseMeta` regex: `/\n*(?:---\n)?<!--\s*relai-board\s*\n([\s\S]*?)\n-->\s*$/` — anchored to end-of-body so unrelated mid-body comments are not matched.
2. **Legacy fallback:** if no fenced block, fall back to the existing `/Parent:\s*#(\d+)/i` regex anywhere in body. Return `{ parent, sort: null }` and leave the body unchanged on read — the legacy line gets stripped naturally on the next write.
3. `serializeMeta` always strips any stale block from `bodyWithout` first (defense in depth) before appending the canonical block.
4. If `meta.parent === null && meta.sort === null`, emit no block at all.

**Wire-through points:**
- `src/parse/tree.ts` — replace the inline `Parent: #N` regex with `parseMeta` to pick up both formats.
- `src/api/github.ts` — `updateIssue` and `createIssue` accept a body that has *already* been serialized by the caller; the serializer call lives in `App.tsx` (or a small `src/state/save.ts`) at the point of sync, where `_modified`/`_new` flags are inspected.
- Markdown importer (current line ~590): stop prepending `Parent: #N` at the top of the body; instead append the fenced block at the bottom via `serializeMeta`.

**Tests for `block.ts` (must all pass before 3b lands):**
1. Round-trip: `serializeMeta(parseMeta(body).bodyWithout, parseMeta(body).meta)` is byte-equal to `body` for a canonical input.
2. Legacy `Parent: #42` body parses to `{ parent: 42, sort: null }`.
3. Body with no metadata at all → `{ parent: null, sort: null }`.
4. Two consecutive `serializeMeta` calls do not produce duplicate blocks.
5. Mid-body `<!-- something else -->` is not matched as the relai-board block.
6. Empty meta (`{ null, null }`) emits no block.

**Verification of 3a (manual against a throwaway repo):**
- Sync a previously-imported issue. Open it on github.com:
  - **Rendered view** must not show the HTML comment.
  - **Edit view** must show it.
- Manually delete the block in GitHub's editor → save → refresh relai-board → next edit+sync rewrites the block (self-healing).
- **Critical:** if any GitHub render path strips `<!-- -->` from the rendered view *and* from the API response, the format breaks. Fallback if so: use a fenced code block ` ```relai-board ` instead — visible in the rendered view but reliably preserved. Verify before building 3b on top.

### Step 3b — `@dnd-kit` reordering + Kanban view

**Library:** `@dnd-kit/core@^6.1` + `@dnd-kit/sortable@^8` + `@dnd-kit/utilities@^3.2`. Chosen over react-dnd (older, larger, awkward backend system) and native HTML5 DnD (no touch, no a11y). `@dnd-kit` is ~15 KB combined, supports keyboard + touch + mouse out of the box.

**Sort key strategy:** sparse integers, gap 1024.
- First load of an issue with no `sort:` → assign `(siblingIndex + 1) * 1024`, mark `_modified`.
- Insertion midpoint: `floor((aSort + bSort) / 2)`. Top: `first - 1024`. Bottom: `last + 1024`.
- **Rebalance trigger:** any adjacent gap `< 2`. Rewrite *only* the affected parent's siblings as `(i + 1) * 1024`, mark all `_modified`. Never global.

**Tree view DnD scope (first PR):** **reorder within siblings only**. No cross-parent drags, no reparenting-by-drag. Cross-parent DnD in a collapsible tree needs hit-testing, expand-on-hover, and cycle detection — explicitly deferred to a follow-up.

Implementation in `TreeNode.tsx`:
- Each sibling group wrapped in `<SortableContext items={siblingIds} strategy={verticalListSortingStrategy}>`.
- Each row uses `useSortable({ id: issue.number })`.
- Single `<DndContext>` at the `App.tsx` level.
- `onDragEnd` computes new `sort:` via midpoint, marks the moved item `_modified`, updates local tree state. The existing PushModal flow then syncs it.

**Kanban view — new file `src/components/KanbanView.tsx`:**

> **Note on tabs:** the existing `tab` state is `'board' | 'add issues' | 'markdown import'` (current line 644). Add `'kanban'` as a fourth tab — do *not* repurpose any existing tab.

- **Columns:** `api.getMilestones()` filtered to `state === 'open'`, plus a leading "No milestone" column for `issue.milestone === null`. Closed milestones are hidden by default — no toggle in v1.
- **Cards:** issue number, title, type pill, non-type labels, closed-state badge. Reuse the existing `Pill` component. Click opens `EditModal`; "↗" button opens `html_url`.
- **Cross-column drag:** optimistic local update, then `PATCH /issues/{n}` with `{ milestone: <number-or-null> }`. On API error, revert local state and surface via the existing `error` state in `App.tsx` (no toast component yet; out of scope to add one).
- **Within-column drag:** new `sort:` via midpoint, mark `_modified`, sync via existing PushModal flow.
- **Collision detection:** `@dnd-kit/core`'s `rectIntersection` (better than `closestCenter` for cards spanning two columns).
- **Empty columns:** wrap each column in `useDroppable` so cards can be dropped into a column with zero existing cards.

**State change in `App.tsx`:** new derived value `useMemo(() => groupBy(flatIssues, i => i.milestone?.number ?? null), [flatIssues])`.

**Verification of 3b (manual smoke against a throwaway repo):**
1. Switch to Kanban tab, columns match open milestones + "No milestone".
2. Drag a card from "No milestone" → a milestone column → Sync → refresh → card persists in new column. (Proves milestone PATCH.)
3. Reorder cards within a column → Sync → refresh → order persists. (Proves sort metadata persisted.)
4. Manually edit the issue body on GitHub, add a paragraph above the metadata block → refresh relai-board → card stays in the same spot. (Proves parser robustness.)
5. Delete the metadata block in GitHub → refresh → card reverts; subsequent edit+sync rewrites the block. (Self-healing.)
6. In tree view, drag a story up one slot → Sync → refresh → order persists.
7. Keyboard-drag with arrow keys (`@dnd-kit` `KeyboardSensor`) for one case — proves a11y.

### Risks for Step 3
- **HTML comments stripped from issue bodies on some GitHub render path** → discover during 3a verification (step above). Fallback is the fenced ` ```relai-board ` code block.
- **Optimistic update + API failure** leaves UI inconsistent → try/catch in the milestone PATCH path, revert local state on failure, surface via existing `error` state.
- **Sparse-integer pathological case** (repeated drags between the same two neighbors) → the `gap < 2` rebalance trigger handles this, scoped to one parent's siblings.
- **Cross-parent DnD scope creep** → keep the first DnD PR strict on sibling-only reorder; reparenting is a follow-up.
- **Closed milestones cluttering the kanban** → hidden-by-default in v1, no toggle.

---

## Critical files

- `index.html` — Step 1 target (4-line diff); also the source-of-truth for extraction in Step 2.
- `src/api/github.ts` — Step 2 (port `GitHubAPI` class with types). Reused unchanged in Step 3.
- `src/parse/tree.ts` — Step 2 (port `parseIssuesToTree`). Updated in Step 3a to call `parseMeta`.
- `src/meta/block.ts` — **Step 3a — the format-defining file.** Most of the new test coverage lives here.
- `src/components/TreeNode.tsx` — Step 3b (sortable wrapping).
- `src/components/KanbanView.tsx` — Step 3b (new file).
- `src/App.tsx` — Step 2 (port). Step 3 (add `'kanban'` tab and `issuesByMilestone` memo).
- `.github/workflows/deploy.yml` — Step 2. The deploy mechanism the whole migration depends on.

## Step ordering / PR shape summary

| Step | PR | Reviewability | Blocks next? |
|------|-----|----|------|
| 1 | Single ~4-line PR against `master` | Trivial | No |
| 2 | One large PR with ~7 logical commits | Walk commit-by-commit | Yes — 3 builds on it |
| 3a | Format change + serializer + tests | Small, focused | Yes — 3b builds on it |
| 3b | DnD + Kanban | Medium, mostly new files | — |
