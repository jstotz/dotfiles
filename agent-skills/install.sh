#!/bin/sh
#
# Install agent skills via the `skills` CLI (https://skills.sh).
# Each skill is symlinked into both ~/.claude/skills and ~/.codex/skills.

set -e

npx --yes skills add https://github.com/openai/skills --skill gh-address-comments -g -a claude-code -a codex
npx --yes skills add https://github.com/openai/skills --skill gh-fix-ci -g -a claude-code -a codex
npx --yes skills add https://github.com/mattpocock/skills --skill grill-me -g -a claude-code -a codex
