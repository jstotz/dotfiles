local wezterm = require("wezterm")
local vim = require("user.lib.vim")
local act = wezterm.action
local module = {}

function module.activate_pane(window, pane, direction)
  local vim_direction = vim.vim_directions[direction]
  if vim.is_vim_pane(pane) then
    window:perform_action(
      act.SendKey({ key = vim_direction, mods = "CTRL" }),
      pane
    )
  else
    window:perform_action(act.ActivatePaneDirection(direction), pane)
  end
end

return module
