#!/bin/sh
[ "$(uname -s)" = "Darwin" ] && exit 0

mkdir -p ~/.config/i3/
ln -sf "$DOTFILES"/i3/config ~/.config/i3/config

mkdir -p ~/.config/i3status/
ln -sf "$DOTFILES"/i3/i3status/config ~/.config/i3status/config
