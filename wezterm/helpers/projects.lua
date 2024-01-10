local wezterm = require("wezterm")
local tablex = require("pl.tablex")
local class = require("pl.class")
local paths = require("helpers.paths")

local module = {}

local Project = class()

module.Project = Project

function Project:_init(opts)
  local dir = opts.dir or wezterm.home_dir
  self.name = opts.name
  self.init = opts.init or function() end
  self.dir = paths.expand_path(dir, wezterm.home_dir)
end

function Project:spawn_tab(window, params)
  local send_text = params.send_text
  local title = params.title
  local cmd = params.cmd
  params.send_text = nil
  params.title = nil
  params.cmd = nil

  -- Make cwd relative to project dir
  params.cwd = paths.expand_path((params.cwd or ""), self.dir)

  wezterm.log_info("spawning tab: ", params)

  local tab, pane, new_window = window:mux_window():spawn_tab(params)
  if title then
    tab:set_title(title)
  end
  if send_text then
    pane:send_text(send_text)
  end
  if cmd then
    pane:send_text(cmd .. "\n")
  end
  return tab, pane, new_window
end

function module.get_projects_dir()
  return wezterm.config_dir .. "/projects"
end

function module.get_project_files()
  local files = {}
  local root_projects = wezterm.glob("*.lua", module.get_projects_dir())
  local nested_projects = wezterm.glob("**/*.lua", module.get_projects_dir())
  for _, file in ipairs(root_projects) do
    table.insert(files, file)
  end
  for _, file in ipairs(nested_projects) do
    table.insert(files, file)
  end
  return files
end

local function load_project(file)
  wezterm.log_info("loading project definition: " .. file)
  local opts = dofile(module.get_projects_dir() .. "/" .. file)
  opts.name = opts.name or file:gsub(".lua$", "")
  opts.dir = opts.dir or wezterm.home_dir
  return Project(opts)
end

function module.get_projects()
  local proj_files = module.get_project_files()
  wezterm.log_info(proj_files)
  return tablex.imap(load_project, proj_files)
end

function module.get_project(name)
  for _, proj in ipairs(module.get_projects()) do
    if proj.name == name then
      return proj
    end
  end
end

return module
