local wezterm = require("wezterm")
local launcher = require("user.launcher")
local panes = require("user.panes")

local module = {}

function module.ActivatePane(direction)
  return wezterm.action_callback(function(window, pane)
    panes.activate_pane(window, pane, direction)
  end)
end

function module.ShowCustomLauncher()
  return wezterm.action_callback(function(window, pane)
    launcher.show_custom_launcher(window, pane)
  end)
end

return module
