#!/usr/bin/env sh

# Terminate already running bar instances
killall -q polybar

# Wait until the processes have been shut down
while pgrep -x polybar >/dev/null; do sleep 1; done

# Launch polybar
polybar -r top &
polybar -r bottom-primary &

for m in $(polybar --list-monitors | grep -v "^eDP1:" | cut -d":" -f1); do
  MONITOR=$m polybar --reload bottom-secondary &
done
