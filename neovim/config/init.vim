let mapleader = ','
set number " Show line numbers

if exists('g:vscode')
  source ~/.config/nvim/vscode.vim
  finish
endif

call plug#begin(stdpath('data') . '/plugged')

Plug 'tpope/vim-surround'
Plug 'easymotion/vim-easymotion'

call plug#end()
