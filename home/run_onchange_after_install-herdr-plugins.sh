#!/bin/sh
set -eu

# Fail rather than record a successful run when prerequisites are missing.
for dependency in herdr mise git jq; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'Missing %s. Install the Brewfile, then rerun chezmoi apply.\n' "$dependency" >&2
        exit 1
    fi
done

# Applying this reviewed, pinned list authorizes Herdr's plugin build steps.
# Edit the revision or add a command to trigger installation on the next apply.
# Supply mise's Cargo to the build even in a fresh, noninteractive shell.
mise exec --cd "$HOME" -- herdr plugin install wyattjoh/herdr-plugin-renamer --ref fadec8f1cadcae8e0b4abdeaf84ceede2990b2e1 --yes
# Matches the smart-splits revision in dot_config/nvim/lua/config/packages.lua.
herdr plugin install mrjones2014/smart-splits.nvim --ref ec76708f1617ef9e2ac353357fe52d2c997a0f06 --yes
# Neovim sidebar and agent annotations; companion is managed alongside this script.
herdr plugin install ChmaraX/herdr-nvim --ref 0450dc7b4c40c986052541c00dba5cdcd1be7ac6 --yes
# Worktrunk runs each repository's own setup hooks before opening its workspace.
herdr plugin install devashish2203/herdr-worktrunk --ref 4be9bbbaab1dfbecc81b298d30624052d0c432d1 --yes
# Navigator v0.3.3 builds with the same mise-managed Cargo as renamer.
mise exec --cd "$HOME" -- herdr plugin install thanhdat77/herdr-navigator --ref 03b803a00341d58382b6cda70a7cd618af5b8806 --yes
# v0.7.0 includes click-to-focus support for Herdr 0.9 clients.
mise exec --cd "$HOME" -- herdr plugin install yankewei/herdr-focus-notify --ref c0da5a2568aa2f39a56abe3a39fd611cc157ddb7 --yes
# v0.7.0 misses macOS's quoted CFBundleIdentifier output, preventing click focus.
# Remove this patch when the pinned upstream version handles both output forms.
focus_notify_root=$(herdr plugin list --plugin herdr-focus-notify --json | jq -er '.result.plugins[0].plugin_root')
focus_notify_patch="$HOME/.config/herdr/patches/focus-notify-lsappinfo.patch"
if ! git -C "$focus_notify_root" apply --reverse --check "$focus_notify_patch" 2>/dev/null; then
    git -C "$focus_notify_root" apply "$focus_notify_patch"
fi
mise exec --cd "$HOME" -- cargo build --release --manifest-path "$focus_notify_root/Cargo.toml"
herdr integration install codex
# Workspace PR checks, review state, and board.
herdr plugin install jmarbutt/herdr-spaces-pr-status --ref 23d26455f9d77863771fee75f287a75e52409e92 --yes
herdr plugin link "$HOME/.config/herdr/plugins/local/review"
herdr integration install claude
