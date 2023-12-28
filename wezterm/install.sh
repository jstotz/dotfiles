#!/bin/sh

set -e

config_dir="$HOME/.config/wezterm"

ln -sf "$DOTFILES/wezterm/" "$config_dir"
