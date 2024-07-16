local wezterm = require("wezterm")
local balance = require("user.lib.balance")
local actions = require("user.actions")

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
      {
        brief = "Rename current tab",
        action = wezterm.action.PromptInputLine({
          description = "Enter new name for tab",
          action = wezterm.action_callback(function(window, _pane, line)
            if line then
              window:active_tab():set_title(line)
            end
          end),
        }),
      },
      {
        brief = "Edit scrollback buffer in vim",
        action = wezterm.action.EmitEvent("trigger-vim-with-scrollback"),
      },
      {
        brief = "Kill current workspace",
        action = actions.KillWorkspace(),
      },
    }
  end)
end

return module
