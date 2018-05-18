#!/bin/sh
[ "$(uname -s)" = "Darwin" ] && exit 0

mkdir -p ~/.config/dunst/
ln -sf "$DOTFILES"/dunst/dunstrc ~/.config/dunst/dunstrc
