#!/usr/bin/env sh

# Terminate already running bar instances
killall -q polybar

# Wait until the processes have been shut down
while pgrep -x polybar >/dev/null; do sleep 1; done

# Launch polybar
index=0
for m in $(xrandr --listmonitors | cut -d " " -f 6 | sed '/^$/d'); do
  if [ $index -eq 0 ]; then
    MONITOR=$m polybar --reload top &
    MONITOR=$m polybar --reload bottom-primary &
  else
    MONITOR=$m polybar --reload bottom-secondary &
  fi
  let index=${index}+1
done
