#!/bin/sh

nvim_config_path=$HOME/.config/nvim

test -e "$nvim_config_path" && {
  echo "$nvim_config_path exists. Skipping install."
  exit
}

echo "Cloning AstroNvim..."
git clone https://github.com/AstroNvim/AstroNvim "$nvim_config_path"

echo "Cloning user AstroNvim config..."
git clone https://github.com/jstotz/nvim "$nvim_config_path/lua/user"

echo "Installing AstroNvim..."
nvim --headless +q
