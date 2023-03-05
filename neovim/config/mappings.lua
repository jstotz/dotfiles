local toggle_term_cmd = astronvim.toggle_term_cmd
local utils = require('user.utils')

return {
  n = {
    ["<leader>gH"] = { (function()
      toggle_term_cmd("lazygit log --filter " ..
      ("%q"):format(utils.git_root_relative_path_current_file()))
    end), desc = "File history" },
  },
}
