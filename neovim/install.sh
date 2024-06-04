#!/bin/sh

nvim_config_path=$HOME/.config/nvim

test -e "$nvim_config_path" && {
  echo "$nvim_config_path exists. Skipping install."
  exit
}

echo "Cloning neovim config..."
git clone https://github.com/jstotz/nvim "$nvim_config_path"

echo "Installing plugins..."
nvim --headless +q
