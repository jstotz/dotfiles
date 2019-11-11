#!/bin/sh
# grc overides for ls
#   Made possible through contributions from generous benefactors like
#   `brew install coreutils`
if [ "$DOTFILES_KERNEL" != "Darwin" ]; then
  alias ls="ls -F --color"
else
  alias ls="ls -F"
fi
alias l="ls -lAh"
alias ll="ls -l"
alias la="ls -A"
alias grep="grep --color=auto"
alias duf="du -sh * | sort -hr"
alias less="less -r"

if [ "$DOTFILES_KERNEL" != "Darwin" ]; then
  if [ -z "$(command -v pbcopy)" ]; then
    if [ -n "$(command -v xclip)" ]; then
      alias pbcopy="xclip -selection clipboard"
      alias pbpaste="xclip -selection clipboard -o"
    elif [ -n "$(command -v xsel)" ]; then
      alias pbcopy="xsel --clipboard --input"
      alias pbpaste="xsel --clipboard --output"
    fi
  fi
  if [ -e /usr/bin/xdg-open ]; then
    alias open="xdg-open"
  fi
fi

# greps non ascii chars
nonascii() {
  LANG=C grep --color=always '[^ -~]\+';
}