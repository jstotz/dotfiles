# Migrating from the legacy dotfiles

Do this once in a regular terminal. Keep it open until the new shell works. These
steps change live configuration; implementing the repository alone does not run
them. Package removal and closing multiplexer sessions are separate decisions.

## Preserve the old source and live settings

From this repository, create a private backup. This commit is the last legacy
implementation; its archive preserves source content even if old symlinks dangle.

```sh
dotfiles_backup=$(mktemp -d "$HOME/dotfiles-backup.XXXXXX")
git archive 00ef940b36ade8496f482c6dcaa21f486df9031d | tar -x -C "$dotfiles_backup"
mkdir "$dotfiles_backup/live"
printf 'Backup: %s\n' "$dotfiles_backup"
dotfiles_git_name=$(git config --global --includes --get user.name)
dotfiles_git_email=$(git config --global --includes --get user.email)
```

Inventory the following paths with `ls -ld` and inspect their contents locally.
Preserve extra Git settings, signing configuration, SSH hosts, and environment
settings in the new local overrides. Do not copy obsolete dotfiles includes or
shell initialization. If capturing Git identity failed, resolve it before continuing.

Move live configuration into the backup, preserving relative paths. This removes
obsolete startup files and conflicting app configuration locations. Broken symlinks
are included. The destination is a new, private backup directory.

```sh
for dotfiles_path in \
  .zshrc .zprofile .zshenv .zsh_plugins.zsh .Brewfile \
  .gitconfig .gitconfig.local .gitignore .editorconfig .gemrc .ackrc \
  .localrc .zshenv.local .zshrc.local .ssh/config .ssh/config.local \
  .config/git/ignore .config/starship.toml .config/atuin/config.toml \
  .config/mise/config.toml .config/herdr/config.toml \
  .config/ghostty/config .config/ghostty/config.ghostty \
  'Library/Application Support/com.mitchellh.ghostty/config' \
  'Library/Application Support/com.mitchellh.ghostty/config.ghostty' \
  .config/lazygit/config.yml 'Library/Application Support/lazygit/config.yml' \
  .config/k9s/config.yaml 'Library/Application Support/k9s/config.yaml' \
  .tmux.conf .config/tmux/tmux.conf .config/sesh/sesh.toml \
  .wezterm.lua .config/wezterm/wezterm.lua; do
  if [ -e "$HOME/$dotfiles_path" ] || [ -L "$HOME/$dotfiles_path" ]; then
    mkdir -p "$dotfiles_backup/live/$(dirname "$dotfiles_path")"
    mv "$HOME/$dotfiles_path" "$dotfiles_backup/live/$dotfiles_path"
  fi
done
```

History databases, SSH keys, caches, plugins, and Neovim remain untouched. If
`XDG_CONFIG_HOME`, `ZDOTDIR`, `STARSHIP_CONFIG`, or an app-specific config override
is set, inspect that location too. This setup uses standard paths with those
overrides unset. Check `.zlogin` and LaunchAgents for locally added calls to old
updaters or launchers and remove those calls manually.

Create a fresh local Git configuration and restore identity:

```sh
test -z "$dotfiles_git_name" || git config --file "$HOME/.gitconfig.local" user.name "$dotfiles_git_name"
test -z "$dotfiles_git_email" || git config --file "$HOME/.gitconfig.local" user.email "$dotfiles_git_email"
```

Restore other intentional Git settings into that file. Create `~/.ssh/config.local`
from retained host settings and `~/.zshrc.local` from retained shell settings. Keep
SSH overrides host-scoped; an old blanket `IdentityAgent` would override 1Password.

## Preview and deploy

Use this checkout explicitly until it is committed and available remotely; do not
initialize an older remote branch by accident.

```sh
brew install chezmoi
chezmoi --source "$PWD" diff
chezmoi --source "$PWD" apply
brew bundle --file="$HOME/.Brewfile" --no-upgrade
mise install --cd "$HOME"
```

Review the mise baseline before installation if the backup contains other global
runtimes. Move project requirements into project configurations. Installed runtimes
are not removed; mise activation selects project runtimes in new shells.

Set `sourceDir` in `chezmoi edit-config` to this absolute checkout path for subsequent
plain commands. The checkout need not be named `~/.dotfiles`. Do not remove an
Orca-managed checkout through ordinary filesystem commands.

Complete [1Password setup](../README.md#1password-and-local-settings). Verify Git
identity, a fresh Zsh shell, Ghostty startup, and Herdr pane creation before closing
your original terminal. Existing sessions can keep running throughout.

## Rollback

Retain the printed backup path. Move each newly deployed target aside before
restoring its corresponding `live/` backup; do not overwrite later changes. For
targets that did not exist before migration, move the new file aside.
`chezmoi managed` lists deployed targets. Restore old startup files last.

Backed-up symlinks still name their original source paths. If those paths no longer
exist, recreate the source from the legacy archive, or replace each link with a
copy of the corresponding archived file. The old shell expects the complete source
at `~/.dotfiles`; preserve any current checkout there before restoring it. Do not
run the legacy bootstrap for rollback: it also installs packages and changes settings.

Keep the backup until you no longer need rollback. No retired packages or tmux
plugins are uninstalled, and legacy configuration remains in Git history.
