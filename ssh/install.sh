#!/bin/sh
test -L ~/.ssh/config || {
  mkdir -p ~/.ssh
  chmod 0700 ~/.ssh
  mv ~/.ssh/config ~/.ssh/config.local
  ln -s "$DOTFILES"/ssh/config ~/.ssh/config
}
test -f ~/.ssh/config.local || touch ~/.ssh/config.local
