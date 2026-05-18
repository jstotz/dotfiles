#!/bin/sh

set -e

config_dir="$HOME/Library/Application Support/com.mitchellh.ghostty"

mkdir -p "$config_dir"
ln -sf "$DOTFILES/ghostty/config" "$config_dir/config"
