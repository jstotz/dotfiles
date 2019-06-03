#!/bin/sh
[ "$(uname -s)" = "Darwin" ] && exit 0

mkdir -p ~/.config/compton/
ln -sf "$DOTFILES"/compton/config ~/.config/compton.conf
