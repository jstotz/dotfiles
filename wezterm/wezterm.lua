local wezterm = require("wezterm")
local config = wezterm.config_builder()
local keys = require("user.keys")
local balance = require("user.balance")

-- General
config.color_scheme = "catppuccin-mocha"
config.window_decorations = "RESIZE"
config.window_close_confirmation = "AlwaysPrompt"
config.scrollback_lines = 100000
config.window_padding = {
  left = 2,
  right = 2,
  top = 0,
  bottom = 0,
}

-- Tab bar font
config.window_frame = {
  font = wezterm.font({ family = "SF Pro", weight = "Bold" }),
  font_size = 14.0,
}

-- Font
config.font = wezterm.font("Fira Code")
config.font_size = 18

-- Workspace / Domains
config.default_workspace = "home"

-- Dim inactive panes
config.inactive_pane_hsb = {
  saturation = 0.9,
  brightness = 0.6,
}

-- Status
wezterm.on("update-right-status", function(window, _pane)
  window:set_right_status(window:active_workspace() .. "   ")
end)

-- Key Bindings
-- Uncomment to debug:
-- config.debug_key_events = true
config.leader = keys.leader
config.keys = keys.keys
config.key_tables = keys.key_tables

balance.setup()

return config
