return {
  dir = "~/.dotfiles",
  init = function(self)
    self:spawn_tab({ title = "dotfiles", cmd = "vim" })
  end,
}
