#!/bin/sh

set -euo pipefail

config_dir="$HOME/.config/wezterm"

ln -sf "$DOTFILES/wezterm/" "$config_dir"

echo "Installing asdf plugins..."
set -x
asdf plugin add golang https://github.com/asdf-community/asdf-golang.git
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
asdf plugin add ruby https://github.com/asdf-vm/asdf-ruby.git
