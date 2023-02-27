#!/bin/sh

set -e

tmux_config_dir="$HOME/.config/tmux"

test -e "$tmux_config_dir/plugins/tpm" || {
  git clone https://github.com/tmux-plugins/tpm "$tmux_config_dir/plugins/tpm"
}

mkdir -p "$tmux_config_dir"
ln -sf "$DOTFILES/tmux/tmux.conf" "$tmux_config_dir/tmux.conf"

"$tmux_config_dir/plugins/tpm/bin/install_plugins"

