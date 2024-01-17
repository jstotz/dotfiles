local wezterm = require("wezterm")
local balance = require("user.lib.balance")

local module = {}

function module.setup(_config)
  wezterm.on("augment-command-palette", function()
    return {
      {
        brief = "Balance panes horizontally",
        action = wezterm.action_callback(balance.balance_panes("x")),
      },
      {
        brief = "Balance panes vertically",
        action = wezterm.action_callback(balance.balance_panes("y")),
      },
    }
  end)
end

return module
