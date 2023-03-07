#!/bin/sh

set -e

alacritty_config_dir="$HOME/.config/alacritty"

mkdir -p "$alacritty_config_dir"

test -e "$alacritty_config_dir/catppuccin" || {
  git clone https://github.com/catppuccin/alacritty.git "$alacritty_config_dir/catppuccin"
}

ln -sf "$DOTFILES/alacritty/alacritty.yml" "$alacritty_config_dir/alacritty.yml"

# Use custom icon
# Borrowed from: https://github.com/hmarr/dotfiles/blob/main/bin/update-alacritty-icon.sh
icon_path=/Applications/Alacritty.app/Contents/Resources/alacritty.icns
if [ ! -f "$icon_path" ]; then
  echo "Can't find existing icon, make sure Alacritty is installed"
  exit 1
fi

echo "Backing up existing icon"
hash="$(shasum $icon_path | head -c 10)"
mv "$icon_path" "$icon_path.backup-$hash"

echo "Downloading replacement icon"
icon_url=https://github.com/hmarr/dotfiles/files/8549877/alacritty.icns.gz
curl -sL $icon_url | gunzip > "$icon_path"

touch /Applications/Alacritty.app
killall Finder
killall Dock
