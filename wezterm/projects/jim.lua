return {
  dir = "~/Projects/jim",
  init = function(self)
    self:spawn_tab({
      title = "nvim",
      cmd = "vim",
    })
  end,
}
