local wezterm = require("wezterm")
local module = {}

function module.kill_workspace(workspace)
  if not workspace then
    error("Workspace must not be nil")
  end
  wezterm.log_info("Killing workspace: " .. workspace)
  for _, w in ipairs(wezterm.mux.all_windows()) do
    wezterm.log_info("Checking window " .. w:get_title())
    if w:get_workspace() == workspace then
      module.kill_mux_window(w)
    end
  end
end

function module.kill_mux_window(mux_window)
  for _, tab in ipairs(mux_window:tabs()) do
    module.kill_tab(tab)
  end
end

function module.kill_tab(tab)
  for _, p in ipairs(tab:panes()) do
    module.kill_pane(p)
  end
end

function module.kill_pane(pane)
  local success, stdout, stderr =
    wezterm.run_child_process({ "wezterm", "cli", "kill-pane", "--pane-id=" .. pane:pane_id() })
  if not success then
    error("killing pane failed: \n" .. stdout .. "\n" .. stderr)
  end
end

return module
