#!/bin/zsh
# Run from any directory. Keep artifacts for inspection; never touch the live home.
set -euo pipefail

preview_shell=false
case "$*" in
  '') ;;
  --preview) preview_shell=true ;;
  --help|-h)
    print 'Usage: zsh -f tests/validate.zsh [--preview]'
    print '  --preview  Run validation, then open the new shell in the temporary home.'
    exit 0
    ;;
  *) print -u2 'Usage: zsh -f tests/validate.zsh [--preview]'; exit 2 ;;
esac
if $preview_shell && [[ ! -t 0 || ! -t 1 ]]; then
  print -u2 -- '--preview requires an interactive terminal.'
  exit 2
fi

repo_dir=${0:A:h:h}
chezmoi_bin=${commands[chezmoi]:?Install chezmoi or put it on PATH first}
validation_dir=$(mktemp -d /tmp/dotfiles-check.XXXXXX)
validation_dir=${validation_dir:A}
validation_home="$validation_dir/home"
mkdir -p "$validation_home"
print "Validation artifacts: $validation_dir"

cm() {
  "$chezmoi_bin" --source "$repo_dir" --destination "$validation_home" \
    --config "$validation_dir/chezmoi.toml" --cache "$validation_dir/cache" \
    --persistent-state "$validation_dir/state.boltdb" --no-tty "$@"
}

cm apply
[[ -f "$validation_home/.zshrc" && ! -L "$validation_home/.zshrc" ]]
[[ ! -e "$validation_home/README.md" && ! -e "$validation_home/tests" ]]
[[ ! -e "$validation_home/.zshenv" ]]
[[ $(stat -f '%Lp' "$validation_home/.ssh") == 700 ]]
[[ $(stat -f '%Lp' "$validation_home/.ssh/config") == 600 ]]

# Unmanaged identity overrides must survive a repeated deployment.
git config --file "$validation_home/.gitconfig.local" user.name 'Dotfiles Test'
git config --file "$validation_home/.gitconfig.local" user.email 'test@example.invalid'
cm apply
[[ -z $(cm diff) ]]
cm verify
[[ $(env -i HOME="$validation_home" PATH=/usr/bin:/bin \
  git config --global --includes --get user.name) == 'Dotfiles Test' ]]
[[ $(env -i HOME="$validation_home" PATH=/usr/bin:/bin \
  git config --global --get core.pager) == delta ]]

# Redirect SSH includes to the isolated home: OpenSSH expands ~ using passwd,
# independently of HOME. No network connection or real host settings are read.
ssh_settings=$(sed "s|~/|$validation_home/|g" "$validation_home/.ssh/config" |
  ssh -F /dev/stdin -G example.invalid 2>/dev/null)
[[ "$ssh_settings" == *'com.1password/t/agent.sock'* ]]
[[ "$ssh_settings" == *'serveraliveinterval 60'* ]]

zsh -n "$validation_home/.zprofile" "$validation_home/.zshrc"

# Runtime managers search parent directories as well as HOME.
cd "$validation_home"

# Exercise real installed integrations, then a bare shell without optional tools.
for validation_path in /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin /usr/bin:/bin:/usr/sbin:/sbin; do
  /usr/bin/script -q /dev/null env -i HOME="$validation_home" ZDOTDIR="$validation_home" \
    XDG_CONFIG_HOME="$validation_home/.config" XDG_DATA_HOME="$validation_home/.local/share" \
    XDG_CACHE_HOME="$validation_home/.cache" \
    MISE_TRUSTED_CONFIG_PATHS="$validation_home" \
    PATH="$validation_path" TERM=xterm-256color /bin/zsh -ic '
      [[ "$EDITOR" == "nvim" && "$VISUAL" == "nvim" ]] || exit 1
      (( $+functions[compdef] )) || exit 1
      [[ $(bindkey -M viins "^[[A") == *up-line-or-history* ]] || exit 1
      [[ $(bindkey -M vicmd "^[[B") == *down-line-or-history* ]] || exit 1
      [[ $(alias vim) == "vim=nvim" ]] || exit 1
      if (( $+commands[atuin] )); then
        [[ $(bindkey -M viins "^R") == *atuin* ]] || exit 1
      fi
      if (( $+commands[fzf] )); then
        [[ $(bindkey -M viins "^T") == *fzf-file-widget* ]] || exit 1
      fi
    '
done

env -i HOME="$validation_home" ZDOTDIR="$validation_home" \
  PATH=/usr/bin:/bin TERM=xterm-256color /bin/zsh -lc '
    [[ "$EDITOR" == "nvim" && "$VISUAL" == "nvim" ]] || exit 1
    [[ "$path[1]" == "$HOME/.local/bin" ]] || exit 1
    (( ! $+functions[compdef] )) || exit 1
  '

if (( $+commands[brew] )); then
  HOMEBREW_NO_AUTO_UPDATE=1 brew bundle list --file="$validation_home/.Brewfile" --all >/dev/null
fi
if (( $+commands[lazygit] )); then
  lazygit_dir=$(env -i HOME="$validation_home" PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
    "${commands[lazygit]}" --print-config-dir)
  [[ -f "$lazygit_dir/config.yml" ]]
fi
if (( $+commands[mise] )); then
  [[ $(env -i HOME="$validation_home" PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
    MISE_TRUSTED_CONFIG_PATHS="$validation_home" \
    "${commands[mise]}" config get --file "$validation_home/.config/mise/config.toml" tools.node) == lts ]]
fi
if [[ -x /Applications/Ghostty.app/Contents/MacOS/ghostty ]]; then
  ghostty_output=$(env -i HOME="$validation_home" PATH=/usr/bin:/bin \
    /Applications/Ghostty.app/Contents/MacOS/ghostty +validate-config \
    --config-file="$validation_home/.config/ghostty/config.ghostty" 2>&1)
  [[ -z "$ghostty_output" ]] || { print -r -- "$ghostty_output"; exit 1; }
fi

print 'PASS: deployment, idempotence, permissions, Git, SSH, and shell startup'
print 'Brewfile and Ghostty validated when installed; no packages installed or sessions started.'

if $preview_shell; then
  print
  print "Opening preview shell in $validation_home"
  print 'Type exit to return. Temporary files are retained for inspection.'
  print 'This isolates shell configuration, not filesystem access or external services.'
  exec env -i HOME="$validation_home" ZDOTDIR="$validation_home" \
    XDG_CONFIG_HOME="$validation_home/.config" XDG_DATA_HOME="$validation_home/.local/share" \
    XDG_CACHE_HOME="$validation_home/.cache" \
    MISE_TRUSTED_CONFIG_PATHS="$validation_home" \
    PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin \
    TERM="${TERM:-xterm-256color}" SHELL=/bin/zsh /bin/zsh -il
fi
