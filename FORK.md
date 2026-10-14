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
- **Fork releases**: `fork-release.yml` and the `build:manifestGenerated` hook
  in `wxt.config.ts`, described below.

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

Fork-only files (this one, `fork-release.yml`) never conflict. Once one of our
features merges upstream, take upstream's version of its files.

Upstream's `ci.yml` is disabled in this fork's Actions settings: its deploy and
Chrome Web Store jobs need uptek's secrets. `fork-release.yml` runs the tests
instead.

## Releasing

Releases keep upstream's version and add a fork build number, so
`v2026.10.10-gk.1` is the first GymKing build of Alfred 2026.10.10. Bump the
build number for each release on the same upstream version, and start again at
1 after merging a new upstream version.

```sh
git checkout main && git pull
git tag v$(jq -r .version package.json)-gk.1
git push origin --tags
```

The workflow checks the tag matches `package.json`, tests, builds with
`FORK_BUILD` set, and publishes `alfred-<version>-gk.<n>-chrome.zip` as a
release on GitHub. To build the same thing locally:
`FORK_BUILD=1 bunx wxt zip`.

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
