#!/bin/sh

# Don't ask ssh password all the time
if [ "$(uname -s)" = "Darwin" ]; then
  git config --global credential.helper osxkeychain
else
  git config --global credential.helper cache
fi

# better diffs
if which diff-so-fancy > /dev/null 2>&1; then
  git config --global core.pager "diff-so-fancy | less --tabs=4 -RFX"
fi

if [ -f $GOPATH/src/github.com/github/hub/etc/hub.zsh_completion ]; then
  ln -sf $GOPATH/src/github.com/github/hub/etc/hub.zsh_completion ~/.zsh/completions/_hub
fi
