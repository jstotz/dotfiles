#!/bin/sh

set -e

alacritty_config_dir="$HOME/.config/alacritty"

mkdir -p "$alacritty_config_dir"

test -e "$alacritty_config_dir/catppuccin" || {
  git clone https://github.com/catppuccin/alacritty.git "$alacritty_config_dir/catppuccin"
}

ln -sf "$DOTFILES/alacritty/alacritty.yml" "$alacritty_config_dir/alacritty.yml"

