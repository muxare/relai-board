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

A landing dashboard composed of widgets, each scoped to all pinned repos:

- Open PRs awaiting your review / your authored PRs (stalled > N days
  highlighted).
- Failing CI on the default branch.
- Issues assigned to you, grouped by repo.
- Dependabot / security alerts count.
- Recent releases and unreleased commits on `main`.
- Stale branches you own.

Implementation notes:

- One small GraphQL query per widget.
- Cache results in IndexedDB with a "last refreshed" timestamp and a
  manual refresh button.

## Phase 3 — Triggerable actions

Move from "view" to "do." Each row gets contextual actions:

- Re-run failed workflow, approve / merge PR, request reviewers, add
  labels, close stale issues.
- Bulk actions across repos: "apply label X to all matching issues,"
  "enable Dependabot," "sync branch protection from a template repo."
- **Workflow dispatch launcher**: pick any `workflow_dispatch` workflow
  across pinned repos and fire it with inputs. Turns the dashboard into a
  personal ops console.

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
