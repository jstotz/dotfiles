#!/bin/sh

# i3-init
# post-start/restart i3 init script

set -euo pipefail

~/.config/i3/configure-inputs.sh
autorandr --change --default standalone
feh --bg-scale ~/wallpaper.jpg
~/.config/polybar/launch.sh
