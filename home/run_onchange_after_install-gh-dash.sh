#!/bin/sh
set -eu

if ! command -v gh >/dev/null 2>&1; then
    printf '%s\n' 'Missing gh. Install the Brewfile, then rerun chezmoi apply.' >&2
    exit 1
fi

# Keep installation idempotent; updates use gh extension upgrade dlvhdr/gh-dash.
if ! gh dash --version >/dev/null 2>&1; then
    gh extension install dlvhdr/gh-dash
fi
