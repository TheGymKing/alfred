#!/bin/sh
# GymKing fork only: builds main and publishes it as a GitHub release.
# Usage: scripts/fork-release.sh <build number>, e.g. 1 for v2026.10.10-gk.1.
# See FORK.md.
set -eu

build="${1:-}"
case "$build" in
  '' | *[!0-9]*) echo "Usage: $0 <build number>" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."
version=$(jq -r .version package.json)
name="$version-gk.$build"
tag="v$name"
zip="alfred-$name-chrome.zip"

if [ "$(git branch --show-current)" != main ]; then
  echo "Release from main." >&2; exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first." >&2; exit 1
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "main differs from origin/main. Push or pull first." >&2; exit 1
fi
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git ls-remote --exit-code --tags origin "$tag" >/dev/null; then
  echo "$tag already exists. Use the next build number." >&2; exit 1
fi

bun test
bun run typecheck
# `bun run zip` would also open Finder; this is the same build.
rm -rf .output
bun run changelog:gen
FORK_BUILD="$build" bun x wxt zip
mv .output/*-chrome.zip ".output/$zip"

git tag -a "$tag" -m "Alfred $name"
git push origin "$tag"
sed -n '/^## Install/,$p' FORK.md > .output/release-notes.md
gh release create "$tag" ".output/$zip" -R TheGymKing/alfred \
  --title "Alfred $name" --notes-file .output/release-notes.md --verify-tag

echo "Released $tag"
