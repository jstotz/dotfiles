local utils = require("astronvim.utils")
local null_ls = require("null-ls")
local cmd_resolver = require("null-ls.helpers.command_resolver")

return {
  "jay-babu/mason-null-ls.nvim",
  opts = function(_, opts)
    opts.automatic_setup = true

    utils.list_insert_unique(opts.ensure_installed, "prettierd")

    opts.handlers = {
      prettier = function()
        null_ls.register(null_ls.builtins.formatting.prettierd.with({
          extra_filetypes = { "ruby" },
          dynamic_command = cmd_resolver.from_yarn_pnp(),
        }))
      end,
      luacheck = function()
        null_ls.register(null_ls.builtins.diagnostics.luacheck.with({
          extra_args = {
            "--config",
            vim.fn.stdpath("config") .. "/.luacheckrc",
          },
        }))
      end,
    }
  end,
}
