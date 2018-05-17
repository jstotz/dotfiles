#!/bin/sh
[ "$(uname -s)" = "Darwin" ] && exit 0
mkdir -p ~/.config/rofi/
ln -sf "$DOTFILES"/rofi/config ~/.config/rofi/config
mkdir -p $HOME/.local/share/rofi/themes/
ln -sf $DOTFILES/rofi/themes/* $HOME/.local/share/rofi/themes/
