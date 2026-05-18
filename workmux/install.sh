#!/bin/sh

set -e

config_dir="$HOME/.config/workmux"

mkdir -p "$config_dir"
ln -sf "$DOTFILES/workmux/config.yaml" "$config_dir/config.yaml"
