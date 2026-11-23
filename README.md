# relai-board

A static web app for managing GitHub issues as hierarchical epics, features, and stories.

## Development

```sh
npm ci          # install dependencies
npm run dev     # start dev server
npm run build   # type-check + production build
npm run preview # preview the production build locally
npm run test    # run tests
npm run lint    # lint with ESLint
npm run format  # format with Prettier
```

Deployed to GitHub Pages via Actions on push to `master`.

## Night shift

The night shift is an unattended runner, not built yet, that will work through approved
issues overnight. Its allowlist is [`nightshift/repos.json`](nightshift/repos.json).

A repo is eligible for the night shift only if it is listed here.

The allowlist is committed rather than kept in the browser because the runner cannot
read the pinned repos, which live in localStorage. Its format is defined by
[`nightshift/repos.schema.json`](nightshift/repos.schema.json), and `npm run test`
checks the file against that schema.

Every proposal, whether it comes from a generator or a human, follows
[`nightshift/PROPOSAL_TEMPLATE.md`](nightshift/PROPOSAL_TEMPLATE.md).
