#!/bin/sh

set -e

config_dir="$HOME/.config/atuin"

ln -sf "$DOTFILES/atuin/config.toml" "$config_dir/config.toml"
