#!/bin/sh
[ "$(uname -s)" = "Darwin" ] && exit 0
mkdir -p ~/.config/termite/
ln -sf "$DOTFILES"/termite/config ~/.config/termite/config
