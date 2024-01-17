local wezterm = require("wezterm")

local config = wezterm.config_builder()

require("user.config.general").setup(config)
require("user.config.status").setup(config)
require("user.config.bindings").setup(config)
require("user.config.commands").setup(config)

return config
