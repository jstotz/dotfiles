#!/bin/sh

test -f ~/.vim/autoload/plug.vim || {
  curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
}

echo "Installing vim plugins..."
vim +PlugInstall +qall >/tmp/vim-plugins.log 2>&1 || true
