#!/bin/sh

set -e

config_dir="$HOME/.config/wezterm"

ln -sf "$DOTFILES/wezterm/" "$config_dir"

echo "Installing wezterm luarocks dependencies..."
sudo luarocks install --force https://raw.githubusercontent.com/luafun/luafun/master/fun-scm-1.rockspec
