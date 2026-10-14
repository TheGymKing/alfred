# GymKing fork of Alfred

This is [TheGymKing/alfred](https://github.com/TheGymKing/alfred), a fork of
[uptek/alfred](https://github.com/uptek/alfred) with tools for our team.
Features we think other merchants would want go upstream as PRs, so the fork
should shrink back toward upstream over time.

## What the fork adds

- **Collection items filter**: on a manually sorted collection, a field above
  the products filters them by title, and "Select N" ticks the matches so
  Shopify's Move (to the beginning, to the end, to a position) works on the
  whole group. It filters the page of products the admin has loaded (100 by
  default, up to 250 with "per page").
- **Fork releases**: `scripts/fork-release.sh` and the
  `build:manifestGenerated` hook in `wxt.config.ts`, described below.

## Branches and remotes

- `origin` is this fork, `upstream` is uptek/alfred.
- `main` is upstream plus our tools. Build releases from it.
- Each feature also lives on its own branch cut from `upstream/main`, so it
  can become an upstream PR without the fork's tooling.

## Pulling upstream into the fork

```sh
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

Fork-only files (this one, `scripts/fork-release.sh`) never conflict. Once one
of our features merges upstream, take upstream's version of its files.

GitHub Actions are off for this fork. Upstream's `ci.yml` deploys uptek's
analytics Worker and publishes to the Chrome Web Store with uptek's secrets, so
leave them off, or disable that workflow if you turn Actions on.

## Releasing

Releases keep upstream's version and add a fork build number, so
`v2026.10.10-gk.1` is the first GymKing build of Alfred 2026.10.10. Bump the
build number for each release on the same upstream version, and start again at
1 after merging a new upstream version.

From an up-to-date, clean `main` (needs `bun`, `jq` and a signed-in `gh`):

```sh
scripts/fork-release.sh 1
```

It tests, builds with `FORK_BUILD` set, tags and pushes `v<version>-gk.<n>`,
and publishes `alfred-<version>-gk.<n>-chrome.zip` as a GitHub release with
the install steps below as its notes.

## Install

1. Download `alfred-…-chrome.zip` from the release's Assets and unzip it
   somewhere permanent, like `Documents/alfred-gymking`. Chrome loads it from
   that folder every time, so don't delete or move it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. If Alfred from the Chrome Web Store is installed, switch it off, or both
   copies run and buttons show up twice.
4. Click **Load unpacked** and choose the unzipped folder. Its card shows the
   fork version, like `2026.10.10-gk.1`.

To update, replace the folder's contents with the new release and click
reload on Alfred's card. Settings are kept.
