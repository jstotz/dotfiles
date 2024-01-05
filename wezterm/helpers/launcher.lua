local wezterm = require("wezterm")
local act = wezterm.action
local mux = wezterm.mux
local shell = require("helpers.shell")
local projects = require("helpers.projects")

local module = {}

local function get_recent_directories()
  local success, stdout, stderr =
    wezterm.run_child_process(shell.shell_command({ "zoxide", "query", "-l" }))
  if not success then
    error("failed to retrieve recent directories with zoxide: " .. stderr)
  end
  return wezterm.split_by_newlines(stdout)
end

function module.start_workspace_init_listener(self)
  if self.workspace_init_listener_started then
    wezterm.log_info("already listening for workspace init")
    return
  end

  wezterm.log_info("listening for workspace init")
  wezterm.on("user-var-changed", function(window, pane, name, value)
    if name ~= "workspace_init" then
      return
    end

    wezterm.log_info("handling workspace_init: " .. value)
    local workspace, pid = string.match(value, "(.+):(.+)")
    local proj = projects.get_project(workspace)

    if proj == nil then
      wezterm.log_error("project for workspace not found: " .. workspace)
      return
    end
    wezterm.log_info("initializing project: ", proj)
    proj:init(window, pane)
    wezterm.run_child_process({ "kill", pid })
  end)
  self.workspace_init_listener_started = true
end

function module.get_launcher_options()
  local options = {
    {
      label = "new-workspace",
      run = function(_self, window, pane)
        window:perform_action(act.SwitchToWorkspace({}), pane)
      end,
    },
  }

  for _, workspace in ipairs(mux.get_workspace_names()) do
    table.insert(options, {
      label = "workspace: " .. workspace,
      run = function(_self, window, pane)
        window:perform_action(act.SwitchToWorkspace({ name = workspace }), pane)
      end,
    })
  end

  for _, proj in ipairs(projects.get_projects()) do
    table.insert(options, {
      label = "project: " .. proj.name,
      run = function(_self, window, pane)
        module:start_workspace_init_listener()
        window:perform_action(
          act.SwitchToWorkspace({
            name = proj.name,
            spawn = {
              args = shell.shell_command({
                "wezterm-workspace-init",
                proj.name,
              }),
            },
          }),
          pane
        )
      end,
    })
  end

  for _, dir in ipairs(get_recent_directories()) do
    table.insert(options, {
      label = "directory: " .. dir,
      run = function(_self, window, pane)
        window:perform_action(
          act.SwitchToWorkspace({ name = dir, spawn = { cwd = dir } }),
          pane
        )
      end,
    })
  end

  return options
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
            option:run(inner_window, inner_pane)
          end
        end
      ),
      title = "Launcher",
      choices = choices,
      fuzzy = true,
      fuzzy_description = "Launch: ",
    }),
    pane
  )
end

return module
