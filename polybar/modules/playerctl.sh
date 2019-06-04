#!/bin/bash

status="$(playerctl status 2>/dev/null)" || exit $?

title=$(exec playerctl metadata xesam:title)
artist=$(exec playerctl metadata xesam:artist)
song_descr="$artist - $title"

if	[ "$status" = "Playing" ]; then
  echo "$song_descr"
elif [ "$status" = "Paused" ]; then
  echo "$song_descr  "
fi
