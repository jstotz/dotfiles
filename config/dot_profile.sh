# alias for editing this file
alias profile='mate -w ~/.profile && source ~/.profile'

export PATH=/opt/local/bin:/opt/local/sbin:$PATH
export MANPATH=/opt/local/share/man:$MANPATH
alias ls='ls -G'

if [ -f /opt/local/etc/bash_completion ]; then
    . /opt/local/etc/bash_completion
fi

export CLASSPATH=/usr/share/ant/lib/:/usr/share/junit/junit.jar:/usr/share/junit/

# Rake task completion
complete -C ~/bin/bash_completion/rake_complete.rb -o default rake

# mategem script completion
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

#gemdoc
export GEMDIR=`gem env gemdir`

gemdoc() {
  open $GEMDIR/doc/`$(which ls) $GEMDIR/doc | grep $1 | sort | tail -1`/rdoc/index.html
}

_gemdocomplete() {
  COMPREPLY=($(compgen -W '$(`which ls` $GEMDIR/doc)' -- ${COMP_WORDS[COMP_CWORD]}))
  return 0
}

complete -o default -o nospace -F _gemdocomplete gemdoc


# script/generate completion
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

# Cache, and complete, Cheats
if [ ! -r ~/.cheats ] || [[ ! "" == `find ~ '.cheats' -ctime 1 -maxdepth 0` ]]; then
  echo "Rebuilding Cheat cache... " 
  cheat sheets | egrep '^ ' | awk {'print $1'} > ~/.cheats
fi
complete -W "$(cat ~/.cheats)" cheat


# creates or reconnects to an existing session based on a
# .screenrc file keyword provided as an argument
# http://ilovett.com/blog/programming/screenrc-for-rails
function s() {
	 screen -D -R -c ~/.screenrc-$1
}

# git
GIT_EDITOR="mate -w"
export GIT_EDITOR
alias staged="git diff --cached" 
alias unstaged="git diff" 
alias both="git diff HEAD"
PS1='\h:\W$(__git_ps1 "(%s)") \u\$ '

PATH=$PATH:~/Scripts:/opt/jruby/bin
export PATH

EDITOR="mate -w"
export EDITOR