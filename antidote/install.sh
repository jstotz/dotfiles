#!/bin/zsh

if command -v brew >/dev/null 2>&1; then
	brew install antidote
fi

. $(brew --prefix)/opt/antidote/share/antidote/antidote.zsh

antidote bundle <"$DOTFILES/antidote/zsh_plugins.txt" >~/.zsh_plugins.zsh
antidote update
