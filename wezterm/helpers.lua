local wezterm = require("wezterm")
local launcher = require("helpers.launcher")
local panes = require("helpers.panes")

local action = {}
local module = { action = action }

function action.ActivatePane(direction)
  return wezterm.action_callback(function(window, pane)
    wezterm.log_info("action! ", direction)
    panes.activate_pane(window, pane, direction)
  end)
end

function action.ShowCustomLauncher()
  return wezterm.action_callback(function(window, pane)
    launcher.show_custom_launcher(window, pane)
  end)
end

return module
