#!/bin/sh
if test "$(which code)"; then
	if [ "$DOTFILES_KERNEL" = "Darwin" ]; then
		VSCODE_HOME="$HOME/Library/Application Support/Code"
	else
		VSCODE_HOME="$HOME/.config/Code"
	fi

	ln -sf "$DOTFILES/vscode/settings.json" "$VSCODE_HOME/User/settings.json"
	ln -sf "$DOTFILES/vscode/keybindings.json" "$VSCODE_HOME/User/keybindings.json"
	ln -sf "$DOTFILES/vscode/snippets" "$VSCODE_HOME/User/snippets"

	# from `code --list-extensions`
	modules="
esbenp.prettier-vscode
mauve.terraform
ms-azuretools.vscode-docker
ms-vscode.Go
ms-vscode.Theme-TomorrowKit
ms-vsliveshare.vsliveshare
Orta.vscode-jest
rebornix.ruby
sleistner.vscode-fileutils
vscodevim.vim
"
	for module in $modules; do
		code --install-extension "$module" || true
	done
fi
