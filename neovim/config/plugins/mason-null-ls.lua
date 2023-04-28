local utils = require("astronvim.utils")
local null_ls = require("null-ls")
local cmd_resolver = require("null-ls.helpers.command_resolver")

return {
  "jay-babu/mason-null-ls.nvim",
  opts = function(_, opts)
    -- Ensure that opts.ensure_installed exists and is a table
    if not opts.ensure_installed then
      opts.ensure_installed = {}
    end
    utils.list_insert_unique(opts.ensure_installed, "prettier")

    opts.handlers = {
      prettier = function()
        null_ls.setup({ debug = true })
        null_ls.register(null_ls.builtins.formatting.prettier.with({
          extra_filetypes = { "ruby" },
          dynamic_command = cmd_resolver.from_yarn_pnp(),
        }))
      end,
    }
  end,
}
