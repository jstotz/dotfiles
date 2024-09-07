#!/bin/sh

set -e

config_dir="$HOME/.config/atuin"

mkdir -p "$config_dir"

ln -sf "$DOTFILES/atuin/config.toml" "$config_dir/config.toml"
