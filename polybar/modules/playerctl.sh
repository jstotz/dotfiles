#!/bin/bash

status="$(playerctl -p spotify status 2>/dev/null)" || exit $?

song_descr=$(playerctl -p spotify metadata -f "{{xesam:artist}} - {{xesam:title}}")

if	[ "$status" = "Playing" ]; then
  echo "$song_descr"
elif [ "$status" = "Paused" ]; then
  echo "$song_descr  "
fi
