if vim.fn.has("nvim-0.12.5") == 0 then
  error("This configuration requires Neovim 0.12.5 or newer")
end

require("config.options")
require("config.packages")
require("config.mini")
require("config.chezmoi")
require("config.languages")
require("config.git")
require("config.herdr")
