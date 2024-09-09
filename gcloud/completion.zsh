#!/bin/sh

# shellcheck disable=SC1090,SC2086
test -f ~/google-cloud-sdk/completion.zsh.inc && . $_
test -f /usr/local/share/google-cloud-sdk/completion.zsh.inc && . $_
