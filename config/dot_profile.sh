# set TextMate as default editor
export EDITOR="mate -w"


# set path
export PATH=$PATH:~/bin:~/Scripts:/opt/jruby/bin:/opt/local/bin:/opt/local/sbin


# add opt to man path
export MANPATH=/opt/local/share/man:$MANPATH
alias ls='ls -G'


# load system-wide bash completion scripts
if [ -f /opt/local/etc/bash_completion ]; then
    . /opt/local/etc/bash_completion
fi


# add ant and junit to java classpath
export CLASSPATH=/usr/share/ant/lib/:/usr/share/junit/junit.jar:/usr/share/junit/


# rake task completion
complete -C ~/bin/bash_completion/rake_complete.rb -o default rake


# mategem command completion
_mategem()
{
    local curw
    COMPREPLY=()
    curw=${COMP_WORDS[COMP_CWORD]}
    local gems="$(gem environment gemdir)/gems"
    COMPREPLY=($(compgen -W '$(ls $gems)' -- $curw));
    return 0
}
complete -F _mategem -o dirnames mategem


# add gemdoc command for viewing locally installed gem rdocs
export GEMDIR=`gem env gemdir`

gemdoc() {
  open $GEMDIR/doc/`$(which ls) $GEMDIR/doc | grep $1 | sort | tail -1`/rdoc/index.html
}

_gemdocomplete() {
  COMPREPLY=($(compgen -W '$(`which ls` $GEMDIR/doc)' -- ${COMP_WORDS[COMP_CWORD]}))
  return 0
}

complete -o default -o nospace -F _gemdocomplete gemdoc


# rails script/generate completion
_generate()
{
  local cur

  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}

  if [ ! -d "$PWD/script" ]; then
    return 0
  fi

  if [ $COMP_CWORD == 1 ] && [[ "$cur" == -* ]]; then
    COMPREPLY=( $( compgen -W '-h -v\
      --help --version'\
      -- $cur ))
    return 0
  fi

  if [ $COMP_CWORD == 2 ] && [[ "$cur" == -* ]]; then
    COMPREPLY=( $( compgen -W '-p -f -s -q -t -c\
      --pretend --force --skip --quiet --backtrace --svn'\
      -- $cur ))
    return 0
  fi

  COMPREPLY=( $(script/generate --help | \
    awk -F ': ' \
      'BEGIN { generators = "" }; \
      /^  (Plugins|Rubygems|Builtin):/ { gsub(/, */, "n", $2); print $2 }' | \
    command grep "^$cur" \
  ))
}

complete -F _generate $default generate


# ruby cheats completion and caching
if [ ! -r ~/.cheats ] || [[ ! "" == `find ~ '.cheats' -ctime 1 -maxdepth 0` ]]; then
  echo "Rebuilding Cheat cache... " 
  cheat sheets | egrep '^ ' | awk {'print $1'} > ~/.cheats
fi
complete -W "$(cat ~/.cheats)" cheat


# git settings
export GIT_EDITOR="mate -w"


# git aliases
alias staged="git diff --cached" 
alias unstaged="git diff" 
alias both="git diff HEAD"


# make terminal prompt indicate current git repository and branch
PS1='\h:\W$(__git_ps1 "(%s)") \u\$ '


# alias for editing and reloading this file
alias profile='mate -w ~/.profile && source ~/.profile'