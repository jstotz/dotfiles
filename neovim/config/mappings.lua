local toggle_term_cmd = require("astronvim.utils").toggle_term_cmd
local utils = require('user.utils')

return {
  n = {
    ["<leader>gH"] = { (function()
      toggle_term_cmd("lazygit log --filter " ..
      ("%q"):format(utils.git_root_relative_path_current_file()))
    end), desc = "File history" },
    ["<leader>gl"] = { "<cmd>Git blame<cr>", desc = "View Git blame" },
    L = { function() require("astronvim.utils.buffer").nav(vim.v.count > 0 and vim.v.count or 1) end, desc = "Next buffer" },
    H = { function() require("astronvim.utils.buffer").nav( -(vim.v.count > 0 and vim.v.count or 1)) end, desc = "Previous buffer" },
  },
}
