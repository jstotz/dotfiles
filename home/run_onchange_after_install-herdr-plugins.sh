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
# reviewr v0.36.2 downloads and verifies its prebuilt release binary.
herdr plugin install persiyanov/herdr-reviewr --ref 4c090225af706bf3aaa24b39fea890a72994f40f --yes
# Matches the smart-splits revision in dot_config/nvim/lua/config/packages.lua.
herdr plugin install mrjones2014/smart-splits.nvim --ref ec76708f1617ef9e2ac353357fe52d2c997a0f06 --yes
# Neovim sidebar and agent annotations; companion is managed alongside this script.
herdr plugin install ChmaraX/herdr-nvim --ref 0450dc7b4c40c986052541c00dba5cdcd1be7ac6 --yes
herdr integration install codex
herdr integration install claude
