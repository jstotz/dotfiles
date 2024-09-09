#!/bin/sh

set -eu

CONFIG_DIR="$HOME/Library/Application Support/k9s"
SKINS_DIR="$CONFIG_DIR/skins"

mkdir -p "$CONFIG_DIR"
mkdir -p "$SKINS_DIR"

echo "Downloading k9s catppuccin skin..."
curl -L https://github.com/catppuccin/k9s/archive/main.tar.gz | tar xz -C "$SKINS_DIR" --strip-components=2 k9s-main/dist

ln -sf "$DOTFILES/k9s/config.yaml" "$CONFIG_DIR/config.yaml"
