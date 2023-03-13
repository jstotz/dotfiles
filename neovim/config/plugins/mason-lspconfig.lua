return {
  "williamboman/mason-lspconfig.nvim",
  opts = {
    ensure_installed = {
      "eslint",
      "golangci_lint_ls",
      "gopls",
      "lua_ls",
      "solargraph",
      "terraformls",
      "tsserver",
    },
  }
}
