#!/bin/zsh

if type fasd &> /dev/null; then
  eval "$(fasd --init auto)"
fi
