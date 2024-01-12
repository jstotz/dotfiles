#!/bin/sh

set -e

config_dir="$HOME/Library/Application Support/lazygit"

mkdir -p "$config_dir"
ln -sf "$DOTFILES/lazygit/config.yml" "$config_dir/config.yml"
