#!/bin/sh
[ "$DOTFILES_KERNEL" = "Darwin" ] && exit 0
mkdir -p ~/.config/termite/
ln -sf "$DOTFILES"/termite/config ~/.config/termite/config
