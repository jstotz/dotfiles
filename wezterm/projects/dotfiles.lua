return {
  dir = "~/.dotfiles",
  init = function(self)
    self:spawn_tab({ title = "dotfiles", cmd = "vim" })
    self:spawn_tab({
      title = "nvim",
      cmd = "vim",
      cwd = "~/.config/nvim/lua/user",
    })
  end,
}
