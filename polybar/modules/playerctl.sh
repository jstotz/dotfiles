#!/bin/bash

status=$(playerctl status) || exit $?

if	[ "$status" = "Playing" ]; then
    title=$(exec playerctl metadata xesam:title)
    artist=$(exec playerctl metadata xesam:artist)
	( echo "$title - $artist  " ) &
elif [ "$status" = "Paused" ]; then
    title=$(exec playerctl metadata xesam:title)
    artist=$(exec playerctl metadata xesam:artist)
	( echo "$title - $artist  " ) &
fi
