#!/bin/sh
[ "$DOTFILES_KERNEL" = "Darwin" ] && exit 0
mkdir -p ~/.config/polybar/
ln -sf "$DOTFILES"/polybar/config ~/.config/polybar/config
ln -sf "$DOTFILES"/polybar/launch.sh ~/.config/polybar/launch.sh
ln -sfT "$DOTFILES"/polybar/modules ~/.config/polybar/modules
