#!/bin/sh
# Builds herdr-nvim for the Herdr desktop app from a pinned, reviewed commit and
# installs it with its own installer (runtime in ~/.local/share/herdr-nvim, its
# mods in the app home). The tracked my-main layout and keys.json already carry
# the installer's edits; rerunning it keeps them as they are.
#
# Runs on every apply but returns at once when this commit is installed. It
# needs the app open, so with the app closed it says so and tries next apply.
# Review the new source before changing the commit.
set -eu

commit=11ae164804b3094c0846f2c6d52a9ac5344fe623
marker=${XDG_DATA_HOME:-$HOME/.local/share}/herdr-nvim/installed-commit

[ "$(cat "$marker" 2>/dev/null)" = "$commit" ] && exit 0
command -v herdr-app >/dev/null 2>&1 || exit 0
if ! herdr-app status >/dev/null 2>&1; then
    echo "herdr-nvim: open the Herdr app, then run chezmoi apply again to install it" >&2
    exit 0
fi
for dependency in git mise nvim; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        printf 'herdr-nvim: missing %s. Install the Brewfile, then rerun chezmoi apply.\n' "$dependency" >&2
        exit 0
    fi
done

src=$(mktemp -d)
trap 'rm -rf "$src"' EXIT
git clone --quiet https://github.com/ChmaraX/herdr-nvim "$src"
git -C "$src" checkout --quiet "$commit"
# Built here rather than downloaded, so what runs is the reviewed source.
mise exec --cd "$HOME" -- cargo build --release --locked --quiet --manifest-path "$src/Cargo.toml"
bash "$src/herdr-app/install.sh" --binary "$src/target/release/herdr-nvim" </dev/null
mkdir -p "$(dirname "$marker")"
echo "$commit" >"$marker"
