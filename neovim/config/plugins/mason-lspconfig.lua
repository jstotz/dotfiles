local utils = require("astronvim.utils")

return {
  "williamboman/mason-lspconfig.nvim",
  opts = function(_, opts)
    if not opts.ensure_installed then
      opts.ensure_installed = {}
    end
    utils.list_insert_unique(opts.ensure_installed, {
      "eslint",
      "golangci_lint_ls",
      "gopls",
      "solargraph",
      "terraformls",
    })
  end,
}
