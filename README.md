# Jay's dotfiles

A small macOS setup using chezmoi, Homebrew, and mise, with Ghostty, Herdr,
Zsh, Starship, and Neovim. Configuration and install scripts live in [home/](home/).

## Initial setup

Install Apple's Command Line Tools (`xcode-select --install`) and
[Homebrew](https://brew.sh), following its shell setup instructions. Sign into
the Mac App Store before installing App Store apps.

```sh
brew install chezmoi
chezmoi init https://github.com/jstotz/dotfiles.git
chezmoi diff
chezmoi apply
```

Applying also installs declared dependencies. Use `--exclude=scripts` for a
files-only apply. To include optional Xcode, set `INSTALL_XCODE=1` on the first apply.

For an existing checkout, use `chezmoi --source /absolute/path/to/checkout`,
or set `sourceDir` in `chezmoi edit-config`.

Set your Git identity locally:

```sh
git config --file "$HOME/.gitconfig.local" user.name 'Your Name'
git config --file "$HOME/.gitconfig.local" user.email 'you@example.com'
```

Finish the machine-specific setup:

- Enable 1Password's SSH agent and CLI integration, and register your public keys
  with your Git hosts. See [SSH setup](https://developer.1password.com/docs/ssh/get-started/)
  and [CLI setup](https://developer.1password.com/docs/cli/get-started/).
- Install and sign into your coding-agent CLIs separately, then launch Ghostty.

## Making changes

```sh
chezmoi edit ~/.zshrc         # edit the source copy
chezmoi diff                 # review pending changes
chezmoi apply                # apply files and changed install scripts
chezmoi cd                   # enter the repository to commit
chezmoi update               # pull and apply committed changes
```

You can also edit this checkout directly. After editing a deployed file, use
`chezmoi re-add /path/to/file` to capture it, then review the diff.

Where to change dependencies:

- Applications and CLI tools: [Brewfile](home/dot_Brewfile).
- Language runtimes: [mise config](home/dot_config/mise/config.toml).
- Herdr plugins and integrations: [install script](home/run_onchange_after_install-herdr-plugins.sh).

Removing a declaration does not uninstall it. Upgrades remain explicit:

```sh
brew bundle --file="$HOME/.Brewfile"
mise upgrade --cd "$HOME"
```

Keep machine-specific settings in `~/.gitconfig.local`, `~/.ssh/config.local`,
and `~/.zshrc.local`; these stay outside the repository.

## Validation and preview

```sh
zsh -f tests/validate.zsh             # validate in a temporary home
zsh -f tests/validate.zsh --preview   # also try the shell interactively
```

Neither command applies to your real home or installs dependencies. Type `exit`
to leave the preview. It isolates configuration, not filesystem or network access.
