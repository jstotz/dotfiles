#!/bin/sh

set -eu

CONFIG_DIR="$HOME/.config"

mkdir -p "$CONFIG_DIR"

ln -sf "$DOTFILES/starship/starship.toml" "$CONFIG_DIR/starship.toml"
