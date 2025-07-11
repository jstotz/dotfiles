local wezterm = require("wezterm")

local module = {}

function module.setup(config)
  -- General
  config.color_scheme = "Catppuccin Mocha"
  config.window_decorations = "RESIZE"
  config.window_close_confirmation = "AlwaysPrompt"
  config.scrollback_lines = 100000
  config.window_padding = {
    left = 2,
    right = 2,
    top = 0,
    bottom = 0,
  }

  config.front_end = "WebGpu"

  -- Tab bar font
  config.window_frame = {
    font = wezterm.font({ family = "SF Pro", weight = "Bold" }),
    font_size = 15.0,
  }

  -- Font
  -- config.font = wezterm.font("Fira Code")
  config.font = wezterm.font("FiraCode Nerd Font")
  config.font_size = 18

  -- Workspace / Domains
  config.default_workspace = "home"

  -- Dim inactive panes
  config.inactive_pane_hsb = {
    saturation = 0.9,
    brightness = 0.6,
  }
end

return module
