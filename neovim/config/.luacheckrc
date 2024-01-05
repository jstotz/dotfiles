-- Global objects
std = {
  globals = {
    "astronvim",
    "astronvim_installation",
    "vim",
    "bit",
  },
}

-- Don't report unused self arguments of methods
self = false

ignore = {
  "631", -- max_line_length
  "211/_.*", -- unused variable, for vars with "_" prefix
  "212/_.*", -- unused argument, for vars with "_" prefix
}
