local wezterm = require("wezterm")

local module = {}

function module.setup(_config)
  -- Status
  wezterm.on("update-right-status", function(window, _pane)
    window:set_right_status("   " .. window:active_workspace() .. "   ")
  end)
end

return module
