local wezterm = require("wezterm")
local module = {}

function module.shell_command(args)
  wezterm.log_info("PATH:", os.getenv("PATH"))
  return {
    os.getenv("SHELL"),
    "-i",
    "-c",
    wezterm.shell_join_args(args),
  }
end

return module
