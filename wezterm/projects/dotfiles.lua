return {
  dir = "~/.dotfiles",
  init = function(self, window, _pane)
    self:spawn_tab(window, { title = "dotfiles", cmd = "vim" })
  end,
}
