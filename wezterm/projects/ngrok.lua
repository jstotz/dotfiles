return {
  init = function(self)
    self:spawn_tab({ title = "ngrok", cmd = "ngrok start --all" })
  end,
}
