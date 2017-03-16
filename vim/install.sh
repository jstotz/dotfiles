#!/bin/sh

test -d ~/.vim/bundle/Vundle.vim || {
  git clone http://github.com/gmarik/vundle.git ./.vim/bundle/vundle
}

vim +PluginInstall! +qall >/tmp/vim-plugins.log 2>&1 || true
