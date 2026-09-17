#!/bin/sh
set -eu

# Upstream plugins own the skill and activity hooks; do not vendor copies.
for dependency in wt codex claude; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Missing %s. Install the Brewfile, then rerun chezmoi apply.\n' "$dependency" >&2
        exit 1
    fi
done

wt --yes config plugins codex install
wt --yes config plugins claude install
