#!/bin/zsh

if type asdf &> /dev/null; then
  . "$HOMEBREW_PREFIX/opt/asdf/libexec/asdf.sh"
fi

test -e ~/.asdf/plugins/golang/set-env.zsh && . $_

export ASDF_GOLANG_MOD_VERSION_ENABLED=true
