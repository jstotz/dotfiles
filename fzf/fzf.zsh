#!/bin/zsh

# shellcheck disable=SC1090,SC2086
test -f /usr/share/fzf/key-bindings.zsh && . $_
test -f /usr/share/fzf/completions.zsh && . $_
test -f ~/.fzf.zsh && . $_

# vimf - Open selected file in Vim
vimf() {
  FILE=$(fzf -q "$1") && nvim "$FILE"
}

# codef - Open selected file in VS Code
codef() {
  FILE=$(fzf -q "$1") && code "$FILE"
}

# fd - cd to selected directory
fd() {
  DIR=$(find ${1:-*} -path '*/\.*' -prune -o -type d -print 2> /dev/null | fzf) && cd "$DIR"
}

# fda - including hidden directories
fda() {
  DIR=$(find ${1:-*} -type d 2> /dev/null | fzf) && cd "$DIR"
}

# fh - repeat history
fh() {
  eval $(history | fzf +s | sed 's/ *[0-9]* *//')
}

# fkill - kill process
fkill() {
  ps -ef | sed 1d | fzf -m | awk '{print $2}' | xargs kill -${1:-9}
}
