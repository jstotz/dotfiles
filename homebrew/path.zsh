#!/bin/sh

test -d /home/linuxbrew/.linuxbrew && {
  # Generated with `brew shellenv`:
  export HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
  export HOMEBREW_CELLAR="/home/linuxbrew/.linuxbrew/Cellar"
  export HOMEBREW_REPOSITORY="/home/linuxbrew/.linuxbrew/Homebrew"
  export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin${PATH+:$PATH}"
  export MANPATH="/home/linuxbrew/.linuxbrew/share/man${MANPATH+:$MANPATH}:"
  export INFOPATH="/home/linuxbrew/.linuxbrew/share/info${INFOPATH+:$INFOPATH}"
}

test -d /opt/homebrew && {
  # Generated with `brew shellenv`:
  export HOMEBREW_PREFIX="/opt/homebrew";
  export HOMEBREW_CELLAR="$HOMEBREW_PREFIX/Cellar";
  export HOMEBREW_REPOSITORY="$HOMEBREW_PREFIX";
  export PATH="$HOMEBREW_PREFIX/bin:$PATH";
  export MANPATH="$HOMEBREW_PREFIX/share/man:$MANPATH";
  export INFOPATH="$HOMEBREW_PREFIX/share/info:$INFOPATH";
}
