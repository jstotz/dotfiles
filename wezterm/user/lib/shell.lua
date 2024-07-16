local wezterm = require("wezterm")
local module = {}

function module.shell_command(args)
  return {
    os.getenv("SHELL"),
    "-i",
    "-c",
    wezterm.shell_join_args(args),
  }
end

function module.run_child_process(args)
  return wezterm.run_child_process(module.shell_command(args))
end

return module
