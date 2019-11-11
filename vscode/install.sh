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
EFanZh.graphviz-preview
PeterJausovec.vscode-docker
Shan.code-settings-sync
Stephanvs.dot
Tyriar.lorem-ipsum
abusaidm.html-snippets
alefragnani.project-manager
alexdima.copy-relative-path
alexkrechik.cucumberautocomplete
angryobject.react-pure-to-class-vscode
bierner.markdown-preview-github-styles
christian-kohler.path-intellisense
coolbear.systemd-unit-file
dbaeumer.vscode-eslint
deerawan.vscode-dash
dlech.chmod
donjayamanne.githistory
doublefint.pgsql
eamodio.gitlens
eg2.tslint
freebroccolo.reasonml
hnw.vscode-auto-open-markdown-preview
marcoms.oceanic-plus
mauve.terraform
mindginative.terraform-snippets
mrmlnc.vscode-duplicate
ms-vscode.azure-account
ms-vscode.cpptools
ms-vscode.Go
ms-vscode.PowerShell
msjsdiag.debugger-for-chrome
patrys.vscode-code-outline
rebornix.Ruby
sporto.rails-go-to-spec
vscodevim.vim
xabikos.JavaScriptSnippets
yzhang.markdown-all-in-one
"
	for module in $modules; do
		code --install-extension "$module" || true
	done
fi
