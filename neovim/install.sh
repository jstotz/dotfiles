#!/bin/sh

nvim_config_path=$HOME/.config/nvim
vimplug_path="${XDG_DATA_HOME:-$HOME/.local/share}"/nvim/site/autoload/plug.vim

test -h $nvim_config_path || {
  test -e $nvim_config_path && {
    echo "$nvim_config_path exists but is not a symlink. Moving to $nvim_config_path.bak"
    mv $nvim_config_path $nvim_config_path.bak
  }
  echo "Creating neovim config symlink..."
  ln -s $DOTFILES/neovim/config $nvim_config_path
}

test -f $vimplug_path || {
  echo "Installing vim-plug..."
  curl -fLo $vimplug_path --create-dirs \
       https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
}

echo "Installing vim plugins..."
nvim -es -u ~/.config/nvim/init.vim -i NONE -c "PlugInstall" -c "qa"

echo "Installing vim plugins for VS Code Neovim extension..."
nvim -es -u $nvim_config_path/vscode.vim -i NONE -c "PlugInstall" -c "qa"
