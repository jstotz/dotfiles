local wezterm = require("wezterm")
local config = wezterm.config_builder()
local helpers = require("helpers")
require("helpers.balance")

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

config.leader = { key = "Space", mods = "CTRL", timeout_milliseconds = 1000 }
config.keys = {
  {
    key = "c",
    mods = "LEADER",
    action = wezterm.action.ActivateCopyMode,
  },

  -- Pane keybindings
  {
    key = "-",
    mods = "LEADER",
    action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
  },
  {
    key = "_",
    mods = "LEADER",
    action = wezterm.action.SplitVertical({ domain = "CurrentPaneDomain" }),
  },
  -- SHIFT is for when caps lock is on
  {
    key = "|",
    mods = "LEADER|SHIFT",
    action = wezterm.action.SplitHorizontal({ domain = "CurrentPaneDomain" }),
  },
  {
    key = "h",
    mods = "CTRL",
    action = helpers.action.ActivatePane("Left"),
  },
  {
    key = "j",
    mods = "CTRL",
    action = helpers.action.ActivatePane("Down"),
  },
  {
    key = "k",
    mods = "CTRL",
    action = helpers.action.ActivatePane("Up"),
  },
  {
    key = "l",
    mods = "CTRL",
    action = helpers.action.ActivatePane("Right"),
  },
  {
    key = "x",
    mods = "LEADER",
    action = wezterm.action.CloseCurrentPane({ confirm = true }),
  },
  {
    key = "z",
    mods = "LEADER",
    action = wezterm.action.TogglePaneZoomState,
  },
  {
    key = "s",
    mods = "LEADER",
    action = wezterm.action.RotatePanes("Clockwise"),
  },
  {
    key = "r",
    mods = "LEADER",
    action = wezterm.action.ActivateKeyTable({
      name = "resize_pane",
      one_shot = false,
    }),
  },
  {
    key = "w",
    mods = "LEADER",
    action = wezterm.action.ShowLauncherArgs({ flags = "FUZZY|WORKSPACES" }),
  },
  {
    key = "t",
    mods = "LEADER",
    action = helpers.action.ShowCustomLauncher(),
  },

  -- vim tabs
  {
    key = "[",
    mods = "CMD",
    action = wezterm.action.SendString("[b"),
  },
  {
    key = "]",
    mods = "CMD",
    action = wezterm.action.SendString("]b"),
  },
}

local resize_increment = 5

config.key_tables = {
  resize_pane = {
    {
      key = "h",
      action = wezterm.action.AdjustPaneSize({ "Left", resize_increment }),
    },
    {
      key = "j",
      action = wezterm.action.AdjustPaneSize({ "Down", resize_increment }),
    },
    {
      key = "k",
      action = wezterm.action.AdjustPaneSize({ "Up", resize_increment }),
    },
    {
      key = "l",
      action = wezterm.action.AdjustPaneSize({ "Right", resize_increment }),
    },
    { key = "Escape", action = "PopKeyTable" },
    { key = "Enter",  action = "PopKeyTable" },
  },
}

return config
