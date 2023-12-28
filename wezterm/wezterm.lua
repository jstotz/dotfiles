local wezterm = require("wezterm")
local mux = wezterm.mux
local act = wezterm.action
local config = wezterm.config_builder()
local helpers = require("helpers")

-- General
config.color_scheme = "catppuccin-mocha"
config.window_decorations = "RESIZE"
config.window_close_confirmation = "AlwaysPrompt"
config.scrollback_lines = 100000

-- Font
config.font = wezterm.font("Fira Code")
config.font_size = 18

-- Workspace / Domains
config.default_workspace = "home"
config.unix_domains = {
  { name = "unix" },
}

config.default_gui_startup_args = { "connect", "unix" }

-- Dim inactive panes
config.inactive_pane_hsb = {
  saturation = 0.9,
  brightness = 0.6,
}

wezterm.on("update-right-status", function(window, _pane)
  window:set_right_status(window:active_workspace() .. "   ")
end)

-- Key Bindings

-- Uncomment to debug:
-- config.debug_key_events = true

config.leader = { key = "Space", mods = "CTRL", timeout_milliseconds = 1000 }
config.keys = {
  -- Send C-a when pressing C-a twice
  {
    key = "a",
    mods = "LEADER",
    action = wezterm.action.SendKey({ key = "a", mods = "CTRL" }),
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
    { key = "Enter", action = "PopKeyTable" },
  },
}
wezterm.on("window-focus-changed", function(window, pane)
  wezterm.log_info(
    "the focus state of ",
    window:window_id(),
    " in workspace ",
    window:active_workspace(),

    " changed to ",
    window:is_focused()
  )
end)

wezterm.on("user-var-changed", function(window, pane, name, value)
  wezterm.log_info(
    "user-var-changed",
    name,
    "=",
    value,
    window:window_id(),
    " in workspace ",
    window:active_workspace(),

    " changed to ",
    window:is_focused()
  )
end)

wezterm.on("gui-startup", function(cmd)
  wezterm.log_info("gui-startup: ", cmd)
end)

wezterm.on("mux-startup", function()
  wezterm.log_info("mux-startup")
end)

-- wezterm.on("update-status", function(window, pane)
--   wezterm.log_info(
--     "update-status",
--     window:window_id(),
--     " in workspace ",
--     window:active_workspace(),
--
--     " changed to ",
--     window:is_focused()
--   )
-- end)
--
-- wezterm.on("gui-startup", function(cmd)
--   -- allow `wezterm start -- something` to affect what we spawn
--   -- in our initial window
--   local args = {}
--   if cmd then
--     args = cmd.args
--   end
--
--   -- Set a workspace for coding on a current project
--   -- Top pane is for the editor, bottom pane is for the build tool
--   local project_dir = wezterm.home_dir .. "/wezterm"
--   local _, build_pane, _ = mux.spawn_window({
--     workspace = "coding",
--     cwd = project_dir,
--     args = args,
--   })
--   local editor_pane = build_pane:split({
--     direction = "Top",
--     size = 0.6,
--     cwd = project_dir,
--   })
--   -- may as well kick off a build in that pane
--   build_pane:send_text("cargo build\n")
--
--   -- A workspace for interacting with a local machine that
--   -- runs some docker containners for home automation
--   local tab, pane, window = mux.spawn_window({
--     workspace = "automation",
--     args = { "ssh", "vault" },
--   })
--
--   -- We want to startup in the coding workspace
--   mux.set_active_workspace("coding")
-- end)
--
return config
