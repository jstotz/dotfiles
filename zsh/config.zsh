#!/bin/zsh
export LSCOLORS='exfxcxdxbxegedabagacad'
export CLICOLOR=true
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=238'

fpath=($DOTFILES/functions $fpath)

autoload -U "$DOTFILES"/functions/*(:t)

autoload -U edit-command-line
zle -N edit-command-line
bindkey '^xe' edit-command-line
bindkey '^x^e' edit-command-line

HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000

# don't nice background tasks
setopt NO_BG_NICE
setopt NO_HUP
setopt NO_LIST_BEEP
# allow functions to have local options
setopt LOCAL_OPTIONS
# allow functions to have local traps
setopt LOCAL_TRAPS
# share history between sessions ???
setopt SHARE_HISTORY
# add timestamps to history
setopt EXTENDED_HISTORY
setopt PROMPT_SUBST
setopt CORRECT
setopt COMPLETE_IN_WORD
# adds history
setopt APPEND_HISTORY
# adds history incrementally and share it across sessions
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY
# don't record dupes in history
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_REDUCE_BLANKS
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_VERIFY
setopt HIST_EXPIRE_DUPS_FIRST
# dont ask for confirmation in rm globs*
setopt RM_STAR_SILENT

# shellcheck disable=SC2004
if (( ${+terminfo[smkx]} )) && (( ${+terminfo[rmkx]} )); then
  function zle-line-init() {
    echoti smkx
  }
  function zle-line-finish() {
    echoti rmkx
  }
  zle -N zle-line-init
  zle -N zle-line-finish
fi

# Use vi key bindings
bindkey -v

# Reduce delay when switching between vi modes
export KEYTIMEOUT=1

# ALT-C - cd into the selected directory
bindkey '\ec' fzf-cd-widget

# load atuin (shell history)
eval "$(atuin init zsh --disable-up-arrow)"
bindkey -M vicmd 'k' atuin-history-up
bindkey -M vicmd 'j' atuin-history-down
bindkey "${key[Up]}" atuin-history-up
bindkey "${key[Down]}" atuin-history-down

