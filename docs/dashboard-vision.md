# Relai-board: from issue board to multi-repo dashboard

Vision for gradually evolving relai-board from a single-repo issue board
into a personal GitHub command center that gives an overview of all your
repos and lets you trigger actions from there.

## Where we are now

- Static SPA hosted on GitHub Pages.
- Cloudflare Worker handling the GitHub OAuth code exchange.
- Repo selector + issue board (epics / features / stories) scoped to one
  repo at a time.

## Phase 1 — Multi-repo foundation

- **Repo registry**: persist a curated set of "pinned" repos. Start with
  `localStorage`, then move to a KV/D1 store via the worker so it syncs
  across devices.
- **Org/user scan**: fetch all repos the user has access to, with filters
  (owner, language, archived, last push). Pin to add to the dashboard.
- **Global scope switcher**: replace "current repo" with a scope picker —
  `all pinned | org | single repo`.
- **Sidebar of pinned repos** as the primary navigation element.

## Phase 2 — Cross-repo overview

A landing dashboard composed of widgets, each scoped to all pinned repos.

Shipped in the initial Phase 2 PR:

- Open PRs awaiting your review (stale > 3 days highlighted).
- Your open PRs (stale > 7 days highlighted).
- Issues assigned to you across pinned repos.
- Plugin-shaped widget interface (`src/widgets/`) — each widget is a
  `{ id, title, fetch, render, empty }` module, so adding a card is one
  file.
- Per-widget and global refresh, with a "last fetched" timestamp.
- Dashboard is the default view when no repo is selected; topbar
  "◀ Dashboard" button returns from a per-repo board view.

Deferred follow-ups (still part of Phase 2 scope):

- **More widgets**: failing CI on the default branch, Dependabot /
  security alerts count, recent releases and unreleased commits on
  `main`, stale branches you own.
- **IndexedDB cache**: today the cache layer
  (`src/storage/widgetCache.ts`) is localStorage-backed. Move to
  IndexedDB once we cache larger payloads (e.g. workflow runs, commit
  lists) that bump against the ~5 MB localStorage budget.
- **GraphQL over REST**: current widgets each fire one REST search
  call, which is fine for three cards. Migrate to a single GraphQL
  query per widget once we add widgets that need joins (e.g. PRs +
  their latest CI status) or when rate-limit pressure shows up.
- **Rate-limit budget UI**: see "Architectural shifts" below — defer
  until the widget count or scan frequency warrants it.

## Phase 3 — Triggerable actions

Move from "view" to "do." Each row gets contextual actions.

Shipped in the initial Phase 3 PR:

- **Row actions** on existing dashboard widgets:
  - PRs awaiting review → ✓ Approve
  - Your open PRs → ⏷ Squash-merge
  - Issues assigned to you → ✕ Close
- **Plugin-shaped `RowAction<T>`** in `src/widgets/types.ts` —
  `{ id, label, visible?, confirm?, run }` — so adding a new per-row
  action is one entry in a widget's `actions` array. Confirmations and
  per-row busy/error state are handled by `IssueList`.
- **Refresh after a row action**: until 2026-11-23 this document said that
  `IssueList` handled the refresh on success, but nothing was connected to
  it and the row stayed until a manual refresh. Since the fix made on
  2026-11-23, `Dashboard` supplies a `refresh` callback in the context it
  passes to `render`, and `IssueList` calls it after a successful action.
  The callback drops that widget's cache entry and refetches that widget
  only, and the row's button stays busy until the refetch has finished.
  A failed action does not refetch. It has not been verified how quickly
  GitHub's search reflects a change, so the refetch might still return a
  row that has just been handled.
- **Workflow dispatch launcher** (`src/components/Workflows.tsx`): pick
  any `workflow_dispatch` workflow across pinned repos, choose a ref,
  fill declared inputs (parsed from the workflow YAML, including
  `choice` / `boolean` types), and fire it. Turns the dashboard into a
  personal ops console.
- **Wider OAuth scope**: bumped from `repo` to `repo workflow` to allow
  workflow dispatch. PR merges / issue closes already fit inside `repo`.
- **Top-bar Dashboard / Workflows switcher** when no repo is selected.

Deferred follow-ups (still part of Phase 3 scope):

- More row actions: re-run failed workflow runs, request reviewers, add
  labels via picker.
- **Bulk actions across repos**: "apply label X to all matching issues,"
  "enable Dependabot," "sync branch protection from a template repo."
- Workflow inputs use a tiny hand-rolled YAML scanner — fine for the
  flat shapes Actions allows, but swap for a real YAML parser if we
  start consuming richer workflow files (composite actions, anchors).

## Phase 4 — Saved views & automations

- Save filter combos as named views ("My Monday review", "Release
  readiness").
- Light client-side automations: "when PR has label `ready` and CI is
  green, auto-merge." Runs while the tab is open, or moves to a scheduled
  Worker job.
- Notifications drawer backed by GitHub's notifications API, with
  mark-read / triage inline.

## Phase 5 — Cross-repo planning

Extend the existing epics / features / stories model beyond one repo:

- An epic in a "planning" repo links to child issues in many
  implementation repos.
- Roll-up progress bars across repos; one Gantt / board view.

## Architectural shifts that enable this

- **GraphQL over REST** for dashboard widgets — one request, many repos,
  fewer rate-limit issues.
- **Worker becomes a thin backend**: today it only handles token
  exchange; later it gains a cache and scheduled jobs (cron triggers) for
  automations.
- **Plugin-shaped widgets**: each widget is a self-contained module
  `{ query, render, actions }` so adding a new card means adding one
  file.
- **Rate-limit budget UI**: a small indicator so heavy scans don't
  silently throttle the app.

## Smallest next step

Phase 1 + a single cross-repo widget — "PRs awaiting my review across
all pinned repos." That one feature proves the multi-repo data layer and
gives the dashboard its first reason to exist beyond the per-repo board.
