#!/bin/sh
set -eu

# Herdr's macOS renderer thickens light-on-dark text unless the app opts out of
# font smoothing; Ghostty draws without it by default.
defaults write dev.herdr.app AppleFontSmoothing -int 0

# Herdr requests Medium for normal terminal text. This private family offers
# Fira Code's Regular face at weight 500 so terminals match Ghostty's weight.
# Remove it once Herdr ships a font_weight setting (herdrdev/herdr-app#332).
source_dir="$HOME/Library/Fonts"
if [ ! -f "$source_dir/FiraCodeNerdFont-Regular.ttf" ]; then
    printf '%s\n' 'Missing FiraCode Nerd Font. Install the Brewfile, then rerun chezmoi apply.' >&2
    exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
    printf '%s\n' 'Missing uv. Install the Brewfile, then rerun chezmoi apply.' >&2
    exit 1
fi

mkdir -p "$HOME/.config/herdr-app/fonts"
uv run --quiet --no-project --with fonttools python - "$source_dir" "$HOME/.config/herdr-app/fonts" <<'EOF'
import sys
from fontTools.ttLib import TTFont

source, target = sys.argv[1:]
family = "FiraCode Nerd Font Herdr"
for style, weight in (("Regular", 500), ("Bold", 700)):
    font = TTFont(f"{source}/FiraCodeNerdFont-{style}.ttf")
    postscript = f"FiraCodeNFHerdr-{style}"
    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = family
        elif record.nameID in (2, 17):
            record.string = style
        elif record.nameID == 3:
            record.string = f"{postscript};herdr-copy"
        elif record.nameID == 4:
            record.string = f"{family} {style}"
        elif record.nameID == 6:
            record.string = postscript
    font["OS/2"].usWeightClass = weight
    font.save(f"{target}/FiraCodeNerdFontHerdr-{style}.ttf")
EOF
