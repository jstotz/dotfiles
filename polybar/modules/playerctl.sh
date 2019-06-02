#!/bin/bash

status="$(playerctl status 2>/dev/null)" || exit $?

title=$(exec playerctl metadata xesam:title)
artist=$(exec playerctl metadata xesam:artist)

if	[ "$status" = "Playing" ]; then
  echo "$title - $artist  "
elif [ "$status" = "Paused" ]; then
  echo "$title - $artist  "
fi
