#!/bin/sh

set -e

config_dir="$HOME/.config/wezterm"

ln -sf "$DOTFILES/wezterm/" "$config_dir"

luarocks install https://raw.githubusercontent.com/luafun/luafun/master/fun-scm-1.rockspec
