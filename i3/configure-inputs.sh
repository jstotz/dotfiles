#!/bin/sh

# i3-init
# post-start/restart i3 init script

set -euo pipefail

xinput --set-prop "SynPS/2 Synaptics TouchPad" "libinput Natural Scrolling Enabled" 1
xinput --set-prop "SynPS/2 Synaptics TouchPad" "libinput Click Method Enabled" 0, 1
setxkbmap -option caps:escape
