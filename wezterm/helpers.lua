local wezterm = require("wezterm")
local act = wezterm.action
local mux = wezterm.mux

local action = {}
local module = { action = action }

local function shell_command(args)
  wezterm.log_info("PATH:", os.getenv("PATH"))
  return {
    os.getenv("SHELL"),
    "-i",
    "-c",
    wezterm.shell_join_args(args),
  }
end

local function is_vim_pane(pane)
  return pane:get_title():lower():find("n?vim") ~= nil
end

local vim_directions = {
  Left = "h",
  Right = "l",
  Up = "j",
  Down = "k",
}

function module.activate_pane(window, pane, direction)
  local vim_direction = vim_directions[direction]
  if is_vim_pane(pane) then
    window:perform_action(
      act.SendKey({ key = vim_direction, mods = "CTRL" }),
      pane
    )
  else
    window:perform_action(act.ActivatePaneDirection(direction), pane)
  end
end

function module.get_recent_directories()
  local success, stdout, stderr =
    wezterm.run_child_process(shell_command({ "zoxide", "query", "-l" }))
  if not success then
    error("failed to retrieve recent directories with zoxide: " .. stderr)
  end
  return wezterm.split_by_newlines(stdout)
end

function module.get_projects()
  return {
    { name = "spacedust" },
  }
end

function module.get_launcher_options()
  local options = {
    { action = "new_workspace", label = "new-workspace", workspace = {} },
  }

  for _, workspace in ipairs(mux.get_workspace_names()) do
    table.insert(options, {
      action = "switch_workspace",
      workspace = workspace,
      label = "workspace: " .. workspace,
    })
  end

  for _, dir in ipairs(module.get_recent_directories()) do
    table.insert(options, {
      cwd = dir,
      action = "new_workspace",
      label = "directory: " .. dir,
      name = dir,
    })
  end

  return options
end

function module.handle_launcher_option(option, window, pane)
  local types = {
    new_workspace = function() end,
  }

  window:perform_action(
    act.SwitchToWorkspace({
      name = option.label,
      spawn = {
        label = "Workspace: " .. option.label,
        cwd = option.cwd,
      },
    }),
    pane
  )
end

function module.show_custom_launcher(window, pane)
  local options = module.get_launcher_options()
  local choices = {}
  for index, option in ipairs(options) do
    table.insert(choices, { id = tostring(index), label = option.label })
  end

  window:perform_action(
    act.InputSelector({
      action = wezterm.action_callback(
        function(inner_window, inner_pane, id, label)
          local option = options[tonumber(id)]
          if not id and not label then
            wezterm.log_info("cancelled")
          else
            wezterm.log_info("id = " .. id)
            wezterm.log_info("label = " .. label)
            module.launch_option(option, inner_window, inner_pane)
          end
        end
      ),
      title = "Choose Workspace",
      choices = choices,
      fuzzy = true,
      fuzzy_description = "Fuzzy find and/or make a workspace: ",
    }),
    pane
  )
end

function action.ShowCustomLauncher()
  return wezterm.action_callback(function(window, pane)
    module.show_custom_launcher(window, pane)
  end)
end

function action.ActivatePane(direction)
  return wezterm.action_callback(function(window, pane)
    module.activate_pane(window, pane, direction)
  end)
end

return module
