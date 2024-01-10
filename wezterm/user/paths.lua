local wezterm = require("wezterm")
local module = {}

function module.expand_path(path, relative_to)
  if relative_to == nil then
    relative_to = ""
  end

  path = path:gsub("~", wezterm.home_dir)

  -- Directory is already absolute
  if path:sub(1, 1) == "/" then
    return path
  end

  return relative_to
    .. (((relative_to.sub(-1, -1) == "/") and "") or "/")
    .. path
end

return module
