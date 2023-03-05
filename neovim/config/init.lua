local config = {
  colorscheme = "catppuccin",
  -- -- Configure general options
  options = {
    g = {
      heirline_bufferline = true,
    },
  },
  -- -- Configure LSP
  lsp = {
    formatting = {
      timeout_ms = 30000,
    },
    diagnostics = {
      timeout_ms = 30000,
    },
  },
  luasnip = {
    vscode = {
      paths = {
        "./lua/user/snippets",
      },
    },
  },
}

return config
