#!/bin/sh

set -e

config_dir="$HOME/.config/sesh"

mkdir -p "$config_dir"
ln -sf "$DOTFILES/sesh/sesh.toml" "$config_dir/sesh.toml"
