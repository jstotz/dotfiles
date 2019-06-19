# Original location: https://github.com/romkatv/dotfiles-public/blob/master/.purepower.
# If you copy this file, keep the link to the original and this sentence intact; you are encouraged
# to change everything else.
#
#                         LEFT PROMPT
#
#   * Your current directory is bright blue when it's writable and brownish when not.
#   * The prompt symbol on the left is '❮' when vicmd keymap is active and '❯' otherwise. It's green
#     if the last command has succeeded and red if it has failed.
#   * Git prompt colors:
#     * Grey: prompt is refreshing in the background (happens only in large repositories).
#     * Green: clean (no stated or unstaged changes and no untracked files).
#     * Yellow: dirty (some stated or unstaged changes).
#     * Teal: some untracked files but otherwise clean (no staged or unstaged changes).
#   * Git prompt icons:
#     * '@12345678' (git prompt color): detached HEAD at commit 12345678.
#     * 'my-feature' (git prompt color): on branch my-feature.
#     * 'my-feature|master' (git prompt color): on branch my-feature tracking remote branch master.
#     * '#my-release' (git prompt color): on tag my-release.
#     * '+' (yellow): staged changes.
#     * '!' (yellow): unstaged changes.
#     * '?' (teal): untracked files.
#     * '⇡42' (green): 42 commits ahead of remote.
#     * '⇣42' (green): 42 commits behind remote.
#     * '*42' (green): 42 stashes.
#
#                        RIGHT PROMPT
#
#   * Error code with an optional signal name of the last command if it failed, in red.
#   * Last command execution time (in seconds).
#   * '⇶' if you have background jobs.
#   * user@host in bright yellow if root, grey otherwise.
#   * If you type `custom_rprompt() { echo 'message' }` in your terminal, you'll get 'message' shown
#     on the right. Useful for integration with your scripts that change some sort of
#     state/environment.

if test -z "${ZSH_VERSION}"; then
  echo "purepower: unsupported shell; try zsh instead" >&2
  return 1
  exit 1
fi

() {
  emulate -L zsh && setopt no_unset pipe_fail

  # `$(_pp_c x y`) evaluates to `y` if the terminal supports >= 256 colors and to `x` otherwise.
  zmodload zsh/terminfo
  if (( terminfo[colors] >= 256 )); then
    function _pp_c() { print -nr -- $2 }
  else
    function _pp_c() { print -nr -- $1 }
    typeset -g POWERLEVEL9K_IGNORE_TERM_COLORS=true
  fi

  # `$(_pp_s x y`) evaluates to `x` in portable mode and to `y` in fancy mode.
  if [[ ${PURE_POWER_MODE:-fancy} == fancy ]]; then
    function _pp_s() { print -nr -- $2 }
  else
    if [[ $PURE_POWER_MODE != portable ]]; then
      echo -En "purepower: invalid mode: ${(qq)PURE_POWER_MODE}; " >&2
      echo -E  "valid options are 'fancy' and 'portable'; falling back to 'portable'" >&2
    fi
    function _pp_s() { print -nr -- $1 }
  fi

  typeset -ga POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
    dir vcs
  )

  typeset -ga POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
    status command_execution_time background_jobs custom_rprompt context
  )

  local ins=$(_pp_s '>' '❯')
  local cmd=$(_pp_s '<' '❮')
  if (( ${PURE_POWER_USE_P10K_EXTENSIONS:-1} )); then
    local p="\${\${\${KEYMAP:-0}:#vicmd}:+${${ins//\\/\\\\}//\}/\\\}}}"
    p+="\${\${\$((!\${#\${KEYMAP:-0}:#vicmd})):#0}:+${${cmd//\\/\\\\}//\}/\\\}}}"
  else
    p=$ins
  fi

  typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true
  typeset -g POWERLEVEL9K_LEFT_SEGMENT_END_SEPARATOR=
  typeset -g POWERLEVEL9K_PROMPT_ON_NEWLINE=true
  typeset -g POWERLEVEL9K_RPROMPT_ON_NEWLINE=false
  typeset -g POWERLEVEL9K_MULTILINE_FIRST_PROMPT_PREFIX=
  typeset -g POWERLEVEL9K_MULTILINE_LAST_PROMPT_PREFIX="%F{%(?.$(_pp_c 2 2).$(_pp_c 1 1))}$p%f "

  typeset -g POWERLEVEL9K_{LEFT,RIGHT}_SEGMENT_SEPARATOR=
  typeset -g POWERLEVEL9K_{LEFT,RIGHT}_SUBSEGMENT_SEPARATOR=' '
  typeset -g POWERLEVEL9K_WHITESPACE_BETWEEN_{LEFT,RIGHT}_SEGMENTS=

  typeset -g POWERLEVEL9K_DIR_SHOW_WRITABLE=true
  typeset -g POWERLEVEL9K_DIR_{ETC,HOME,HOME_SUBFOLDER,DEFAULT,NOT_WRITABLE}_BACKGROUND=none
  typeset -g POWERLEVEL9K_DIR_NOT_WRITABLE_FOREGROUND=$(_pp_c 3 209)
  typeset -g POWERLEVEL9K_DIR_{HOME,HOME_SUBFOLDER,ETC,DEFAULT}_FOREGROUND=$(_pp_c 12 12)
  typeset -g POWERLEVEL9K_{ETC,FOLDER,HOME,HOME_SUB,LOCK}_ICON=

  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED,LOADING}_BACKGROUND=none
  typeset -g POWERLEVEL9K_VCS_CLEAN_FOREGROUND=$(_pp_c 2 2)
  typeset -g POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND=$(_pp_c 6 14)
  typeset -g POWERLEVEL9K_VCS_MODIFIED_FOREGROUND=$(_pp_c 3 11)
  typeset -g POWERLEVEL9K_VCS_LOADING_FOREGROUND=$(_pp_c 5 244)
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_UNTRACKEDFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_UNTRACKED_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_UNSTAGEDFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_MODIFIED_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_STAGEDFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_MODIFIED_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_INCOMING_CHANGESFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_CLEAN_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_OUTGOING_CHANGESFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_CLEAN_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_STASHFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_CLEAN_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{CLEAN,UNTRACKED,MODIFIED}_ACTIONFORMAT_FOREGROUND=1
  typeset -g POWERLEVEL9K_VCS_LOADING_ACTIONFORMAT_FOREGROUND=$POWERLEVEL9K_VCS_LOADING_FOREGROUND
  typeset -g POWERLEVEL9K_VCS_{GIT,GIT_GITHUB,GIT_BITBUCKET,GIT_GITLAB,BRANCH}_ICON=
  typeset -g POWERLEVEL9K_VCS_REMOTE_BRANCH_ICON=$'%{\b|%}'
  typeset -g POWERLEVEL9K_VCS_COMMIT_ICON='@'
  typeset -g POWERLEVEL9K_VCS_UNTRACKED_ICON='?'
  typeset -g POWERLEVEL9K_VCS_UNSTAGED_ICON='!'
  typeset -g POWERLEVEL9K_VCS_STAGED_ICON='+'
  typeset -g POWERLEVEL9K_VCS_INCOMING_CHANGES_ICON=$(_pp_s '<' '⇣')
  typeset -g POWERLEVEL9K_VCS_OUTGOING_CHANGES_ICON=$(_pp_s '>' '⇡')
  typeset -g POWERLEVEL9K_VCS_STASH_ICON='*'
  typeset -g POWERLEVEL9K_VCS_TAG_ICON=$'%{\b#%}'
  typeset -g POWERLEVEL9K_VCS_{STAGED,UNSTAGED}_MAX_NUM=99

  typeset -g POWERLEVEL9K_STATUS_OK=false
  typeset -g POWERLEVEL9K_STATUS_ERROR_BACKGROUND=none
  typeset -g POWERLEVEL9K_STATUS_ERROR_FOREGROUND=$(_pp_c 9 9)
  typeset -g POWERLEVEL9K_CARRIAGE_RETURN_ICON=

  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_THRESHOLD=5
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_BACKGROUND=none
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND=$(_pp_c 5 13)
  typeset -g POWERLEVEL9K_EXECUTION_TIME_ICON=""

  typeset -g POWERLEVEL9K_BACKGROUND_JOBS_VERBOSE=false
  typeset -g POWERLEVEL9K_BACKGROUND_JOBS_BACKGROUND=none
  typeset -g POWERLEVEL9K_BACKGROUND_JOBS_VISUAL_IDENTIFIER_COLOR=2
  typeset -g POWERLEVEL9K_BACKGROUND_JOBS_ICON=$(_pp_s '%%' '⇶')

  typeset -g POWERLEVEL9K_CUSTOM_RPROMPT=custom_rprompt
  typeset -g POWERLEVEL9K_CUSTOM_RPROMPT_BACKGROUND=none
  typeset -g POWERLEVEL9K_CUSTOM_RPROMPT_FOREGROUND=$(_pp_c 4 12)

  typeset -g POWERLEVEL9K_CONTEXT_{DEFAULT,ROOT,REMOTE_SUDO,REMOTE,SUDO}_BACKGROUND=none
  typeset -g POWERLEVEL9K_CONTEXT_{DEFAULT,REMOTE_SUDO,REMOTE,SUDO}_FOREGROUND=$(_pp_c 7 244)
  typeset -g POWERLEVEL9K_CONTEXT_ROOT_FOREGROUND=$(_pp_c 3 11)

  unfunction _pp_c _pp_s
} "$@"
