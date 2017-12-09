#!/bin/sh
# shellcheck disable=SC1090
test -e /usr/local/bin/aws_zsh_completer.sh && .  "$_"
test -e /usr/local/share/zsh/site-functions/aws_zsh_completer.sh && .  "$_"
