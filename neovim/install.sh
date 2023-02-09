#!/bin/sh

nvim_config_path=$HOME/.config/nvim

test -e "$nvim_config_path" && {
  echo "$nvim_config_path exists. Skipping install."
  exit
}

echo "Cloning AstroNvim..."
git clone https://github.com/AstroNvim/AstroNvim ~/.config/nvim

echo "Creating neovim user config symlink..."
ln -s "$DOTFILES/neovim/config" "$nvim_config_path/lua/user"

echo "Installing plugins..."
nvim  --headless -c 'autocmd User PackerComplete quitall'
