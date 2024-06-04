return {
  dir = "~/.config/nvim",
  init = function(self)
    self:spawn_tab({
      title = "nvim",
      cmd = "vim",
    })
  end,
}
