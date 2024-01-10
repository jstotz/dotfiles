return {
  dir = "~/.dotfiles",
  init = function(self, window, _pane)
    local dotfiles_vim_tab =
        self:spawn_tab(window, { title = "dotfiles", cmd = "vim" })
    self:spawn_tab(
      window,
      { title = "nvim", cmd = "vim", cwd = "~/.config/nvim/lua/user" }
    )
    dotfiles_vim_tab:activate()
  end,
}
