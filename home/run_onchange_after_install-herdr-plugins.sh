#!/bin/sh
set -eu

# Fail rather than record a successful run when prerequisites are missing.
for dependency in herdr mise git; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Missing %s. Install the Brewfile, then rerun chezmoi apply.\n' "$dependency" >&2
        exit 1
    fi
done

# Applying this reviewed, pinned list authorizes Herdr's plugin build steps.
# Edit the revision or add a command to trigger installation on the next apply.
# Supply mise's Cargo to the build even in a fresh, noninteractive shell.
mise exec --cd "$HOME" -- herdr plugin install wyattjoh/herdr-plugin-renamer --ref fadec8f1cadcae8e0b4abdeaf84ceede2990b2e1 --yes
herdr integration install codex
herdr integration install claude
