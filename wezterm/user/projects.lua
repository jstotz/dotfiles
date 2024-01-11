local wezterm = require("wezterm")
local fun = require("fun")
local paths = require("user.paths")

local module = {}

local Project = {}

function Project:new(opts)
  local proj = {}
  setmetatable(proj, self)
  self.__index = self

  local dir = opts.dir or wezterm.home_dir
  proj.name = opts.name
  proj._init = opts.init or function() end
  proj.dir = paths.expand_path(dir, wezterm.home_dir)

  return proj
end

function Project:launch(window, pane)
  local tabs = window:mux_window():tabs()
  self.window = window
  self.pane = pane
  self:_init()
  if #tabs > 0 then
    tabs[1]:activate()
  end
end

function Project:spawn_tab(params)
  local send_text = params.send_text
  local title = params.title
  local cmd = params.cmd
  params.send_text = nil
  params.title = nil
  params.cmd = nil

  -- Make cwd relative to project dir
  params.cwd = paths.expand_path((params.cwd or ""), self.dir)

  wezterm.log_info("spawning tab: ", params)

  local tab, pane, new_window = self.window:mux_window():spawn_tab(params)
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
  return fun
      .chain(
        wezterm.glob("*.lua", module.get_projects_dir()),
        wezterm.glob("**/*.lua", module.get_projects_dir())
      )
      :totable()
end

local function load_project(file)
  wezterm.log_info("loading project definition: " .. file)
  local opts = dofile(module.get_projects_dir() .. "/" .. file)
  opts.name = opts.name or file:gsub(".lua$", "")
  opts.dir = opts.dir or wezterm.home_dir
  return Project:new(opts)
end

function module.get_projects()
  local proj_files = module.get_project_files()
  wezterm.log_info("project_files: ", proj_files)
  return fun.map(load_project, proj_files):totable()
end

function module.get_project(name)
  for _, proj in ipairs(module.get_projects()) do
    if proj.name == name then
      return proj
    end
  end
end

return module
