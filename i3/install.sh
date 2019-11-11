#!/bin/sh
[ "$DOTFILES_KERNEL" = "Darwin" ] && exit 0

ln -sf "$DOTFILES"/i3/xinitrc ~/.xinitrc
ln -sf "$DOTFILES"/i3/Xresources ~/.Xresources
ln -sf "$DOTFILES"/i3/xplugrc ~/.config/xplugrc

mkdir -p ~/.config/i3/
ln -sf "$DOTFILES"/i3/config ~/.config/i3/config
ln -sf "$DOTFILES"/i3/bin ~/.config/i3/

mkdir -p ~/.config/i3status/
ln -sf "$DOTFILES"/i3/i3status/config ~/.config/i3status/config
