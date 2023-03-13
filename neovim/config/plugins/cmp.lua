return {
  "hrsh7th/nvim-cmp",
  opts = function(_, opts)
    local cmp = require "cmp"
    opts.mapping["<CR>"] = cmp.mapping.confirm { select = true }
    return opts
  end
}
