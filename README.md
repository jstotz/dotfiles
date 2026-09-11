# Jay's dotfiles

A small macOS workstation setup: chezmoi manages files, Homebrew Bundle installs
applications and CLI tools, and mise manages language runtimes. Ghostty opens
Herdr; pane shells use Zsh with Starship, Atuin, fzf, and zoxide.

There are no installation hooks, plugin downloads, or automatic package upgrades.
Intel and Apple Silicon Macs use the same files and the system `/bin/zsh`.

## Install

**Already using the old dotfiles? Follow [migration](docs/migration.md) first.**

1. Install Apple's Command Line Tools (`xcode-select --install`) and
   [Homebrew](https://brew.sh). Follow Homebrew's printed shell setup instructions.
2. Install chezmoi and initialize the repository without applying yet:

   ```sh
   brew install chezmoi
   chezmoi init https://github.com/jstotz/dotfiles.git
   chezmoi diff
   chezmoi apply
   ```

   For another branch, add `--branch BRANCH` to `chezmoi init`. For an existing
   checkout, use `chezmoi --source /absolute/path/to/checkout` for each command,
   or set `sourceDir` to that path in `chezmoi edit-config`. `.chezmoiroot` selects
   the `home/` subdirectory automatically.
3. Install the declared packages. Sign into the Mac App Store first for `mas`
   applications; a failed install can be rerun after signing in.

   ```sh
   brew bundle --file="$HOME/.Brewfile" --no-upgrade
   ```

   Set `INSTALL_XCODE=1` on that command to include Xcode. Its default is off.
4. Install the global Node LTS runtime:

   ```sh
   mise install --cd "$HOME"
   ```

   Projects declare other runtime versions in their own mise configuration.
   `mise use node@VERSION` sets a project version; `mise use --global` changes your
   global settings, which you can capture with `chezmoi re-add`.
5. Set your local Git identity (this file stays outside the repository):

   ```sh
   git config --file "$HOME/.gitconfig.local" user.name 'Your Name'
   git config --file "$HOME/.gitconfig.local" user.email 'you@example.com'
   ```

6. Zed is the default editor. Neovim uses its independent repository:

   ```sh
   if [ ! -e "$HOME/.config/nvim" ] && [ ! -L "$HOME/.config/nvim" ]; then
     git clone https://github.com/jstotz/nvim "$HOME/.config/nvim"
   fi
   ```

   Launch `nvim` to finish its plugin setup. Existing Neovim configuration is never
   replaced. Git LFS repositories can run `git lfs install --local`.
7. Complete the 1Password setup below, then launch Ghostty. Herdr's onboarding is
   disabled. Its built-in help (`Ctrl-Space`, then `?`) shows the
   default bindings. Zsh does not start Herdr, so new panes cannot recurse.

Ghostty retains Catppuccin Mocha and FiraCode Nerd Font. Its tab shortcuts send
Herdr's Ctrl-Space prefix followed by the corresponding default action:

| Shortcut | Herdr action |
| --- | --- |
| Cmd-T | New tab |
| Cmd-W or Cmd-Option-W | Close the current tab, including its panes |
| Ctrl-Tab or Cmd-Shift-] | Next tab |
| Ctrl-Shift-Tab or Cmd-Shift-[ | Previous tab |
| Cmd-1 through Cmd-9 | Select tab 1 through 9 |

Cmd-9 selects the ninth Herdr tab, rather than Ghostty's last-tab behavior.
Window, split, and undo shortcuts remain Ghostty-native; reopening a closed
Herdr tab with Cmd-Shift-T is not supported by these mappings. If you change the
Herdr prefix or tab action bindings, update the Ghostty sequences too.

If Herdr is not installed, Ghostty opens Zsh, but these shortcuts still send their
Herdr sequences; they do not fall back to native tab management.

## 1Password and local settings

In 1Password **Settings → Developer**, enable the SSH agent and CLI desktop
integration. Add/import your SSH keys into 1Password and register their public keys
with your Git/SSH hosts. Private keys are not stored in this repository. See
[SSH setup](https://developer.1password.com/docs/ssh/get-started/) and
[CLI setup](https://developer.1password.com/docs/cli/get-started/).

`op whoami` verifies CLI integration. `ssh -G github.com` shows effective SSH
configuration without connecting. Once keys are ready, `ssh -T git@github.com`
checks authentication (GitHub's successful greeting normally exits with code 1).
HTTPS Git authentication continues to use the macOS Keychain.

These files are deliberately unmanaged:

| File | Purpose |
| --- | --- |
| `~/.gitconfig.local` | Git identity, signing, and machine-specific overrides |
| `~/.ssh/config.local` | Host-specific SSH settings; loaded before global defaults |
| `~/.zshrc.local` | Optional shell settings, loaded before highlighting |

For a host needing a particular 1Password key, set `IdentityFile` to its **public**
key file and `IdentitiesOnly yes` in the local SSH config. OrbStack's generated SSH
config is included ahead of global defaults. No secret templates, startup-time
vault lookups, or Git signing changes are included. Agent tools and their skills
are managed independently.

## Daily use

```sh
chezmoi edit ~/.zshrc          # edit the source copy
chezmoi diff                 # preview changes
chezmoi apply                # deploy configuration files
chezmoi cd                   # enter the source repository to commit changes
```

Files are ordinary deployed copies, not symlinks. After editing a deployed file
directly (including settings changed by an application's UI), use
`chezmoi re-add /path/to/file` and review the source diff before committing.
Use `chezmoi update` to pull and apply committed configuration changes.

Package operations remain explicit:

```sh
brew bundle --file="$HOME/.Brewfile" --no-upgrade  # install missing packages
brew bundle --file="$HOME/.Brewfile"               # install and upgrade
mise install --cd "$HOME"                         # install declared runtimes
mise upgrade --cd "$HOME"                         # explicitly upgrade runtimes
```

Removing a package from the Brewfile does not uninstall it. Avoid blanket
`brew bundle cleanup`: this list intentionally doesn't own every installed tool.

Zsh uses built-in vi mode, normal arrow-key history, Atuin on Ctrl-R, fzf on Ctrl-T
and Alt-C, and zoxide's `z`/`zi`. Only basic listing, direct Git shorthand, and
Neovim aliases remain. Cloud authentication and project environment configuration
belong to those tools/projects.

## Layout and validation

`home/` is chezmoi's source root. `dot_` maps to a leading dot, and `private_` sets
restrictive permissions. The Brewfile deploys as `~/.Brewfile`; app configuration
lives under `~/.config`, except lazygit, which uses its native macOS
`~/Library/Application Support/lazygit` directory. Documentation and tests are not deployed. Global Git
ignores contain editor/OS artifacts; project-specific ignores (including environment
files) belong in each project's `.gitignore`.

Run `zsh -f tests/validate.zsh` with chezmoi installed. It applies twice to an isolated
temporary home, checks idempotence and permissions, exercises Zsh with and without
optional tools, parses Git/SSH settings, and validates the Brewfile and Ghostty
configuration when available. It never applies to your home, installs packages,
starts Herdr, or authenticates to external services.

To run those checks and then try the new shell interactively:

```sh
zsh -f tests/validate.zsh --preview
```

The preview starts in the temporary home with a clean environment and isolated
configuration, history, and cache paths. Type `exit` to return to your original
shell; the temporary files remain available for inspection. It uses tools already
installed and does not launch Ghostty or Herdr. This is configuration isolation,
not a filesystem sandbox: commands you run can still access your Mac and services.
