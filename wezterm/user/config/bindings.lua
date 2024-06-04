local wezterm = require("wezterm")
local actions = require("user.actions")

local module = {}

local resize_increment = 5

function module.setup(config)
  -- Uncomment to debug:
  -- config.debug_key_events = true

  config.leader = { key = "Space", mods = "CTRL", timeout_milliseconds = 1000 }

  config.keys = {
    {
      key = "k",
      mods = "SUPER",
      action = wezterm.action.Multiple({
        wezterm.action.SendKey({ key = "L", mods = "CTRL" }),
      }),
    },
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
      action = actions.ActivatePane("Left"),
    },
    {
      key = "j",
      mods = "CTRL",
      action = actions.ActivatePane("Down"),
    },
    {
      key = "k",
      mods = "CTRL",
      action = actions.ActivatePane("Up"),
    },
    {
      key = "l",
      mods = "CTRL",
      action = actions.ActivatePane("Right"),
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
      action = actions.ShowCustomLauncher(),
    },
    {
      key = "Space",
      mods = "LEADER|CTRL",
      action = actions.ShowCustomLauncher(),
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
    {
      key = "UpArrow",
      mods = "SHIFT",
      action = wezterm.action.ScrollToPrompt(-1),
    },
    {
      key = "DownArrow",
      mods = "SHIFT",
      action = wezterm.action.ScrollToPrompt(1),
    },
    {
      key = "E",
      mods = "CTRL",
      action = wezterm.action.EmitEvent("trigger-vim-with-scrollback"),
    },
    -- Override macOS window switching to switch workspaces
    { key = "`", mods = "CMD",       action = wezterm.action.SwitchWorkspaceRelative(1) },
    { key = "`", mods = "CMD|SHIFT", action = wezterm.action.SwitchWorkspaceRelative(-1) },
  }

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

  config.mouse_bindings = {
    {
      event = { Down = { streak = 3, button = "Left" } },
      action = wezterm.action.SelectTextAtMouseCursor("SemanticZone"),
      mods = "NONE",
    },
  }
end

return module
