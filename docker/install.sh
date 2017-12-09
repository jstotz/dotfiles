#!/bin/sh

set -eu

mkdir -p "$HOME/.docker/completions"

if which docker-compose > /dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/docker/compose/master/contrib/completion/zsh/_docker-compose \
    -o "$HOME/.docker/completions/_docker-compose"
fi

if which docker > /dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/docker/cli/master/contrib/completion/zsh/_docker \
    -o "$HOME/.docker/completions/_docker"
fi
