local wezterm = require("wezterm")
local launcher = require("user.lib.launcher")

local module = {}

function module.ShowCustomLauncher()
  return wezterm.action_callback(function(window, pane)
    launcher.show_custom_launcher(window, pane)
  end)
end

return module
