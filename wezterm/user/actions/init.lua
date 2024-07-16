local wezterm = require("wezterm")
local launcher = require("user.lib.launcher")
local kill = require("user.lib.kill")

local module = {}

function module.ShowCustomLauncher()
  return wezterm.action_callback(function(window, pane)
    launcher.show_custom_launcher(window, pane)
  end)
end

function module.KillWorkspace()
  return wezterm.action_callback(function(window, _pane)
    kill.kill_workspace(window:mux_window():get_workspace())
  end)
end

return module
