local wezterm = require("wezterm")
local fun = require("fun")
local paths = require("user.lib.paths")
local balance = require("user.lib.balance")

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
  local title = params.title
  local splits = params.splits or {}
  params.title = nil
  -- Make cwd relative to project dir
  params.cwd = paths.expand_path((params.cwd or ""), self.dir)

  wezterm.log_info("spawning tab: ", params)

  local tab, pane, new_window = self.window:mux_window():spawn_tab(params)
  if title then
    tab:set_title(title)
  end

  self:run_in_pane(pane, params)

  for idx, split in ipairs(splits) do
    split = fun.chain(params, split):tomap()
    if idx == 1 then
      self:run_in_pane(pane, split)
    else
      pane = self:split_pane(pane, split)
    end
  end

  balance.balance_panes("y")

  return tab, pane, new_window
end

function Project:split_pane(pane, params)
  local default_params = { direction = "Bottom" }
  params = fun.chain(default_params, params, { cwd = paths.expand_path((params.cwd or ""), self.dir) }):tomap()
  wezterm.log_info("splitting pane: ", params)
  local new_pane = pane:split(params)
  self:run_in_pane(new_pane, params)
  return new_pane
end

function Project:run_in_pane(pane, params)
  wezterm.log_info("running in pane: ", params)
  if params.send_text then
    pane:send_text(params.send_text)
  end
  if params.cmd then
    pane:send_text(params.cmd .. "\n")
  end

  return pane
end

function module.get_projects_dir()
  return wezterm.config_dir .. "/projects"
end

function module.get_project_files()
  return wezterm.glob("**/*.lua", module.get_projects_dir())
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
