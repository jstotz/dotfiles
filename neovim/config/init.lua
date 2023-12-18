return {
  colorscheme = "catppuccin",
  lsp = {
    formatting = {
      timeout_ms = 10000,
    },
    diagnostics = {
      timeout_ms = 10000,
    },
    config = {
      gopls = {
        settings = {
          gopls = {
            hints = {
              assignVariableTypes = true,
              compositeLiteralFields = true,
              compositeLiteralTypes = true,
              constantValues = true,
              functionTypeParameters = true,
              parameterNames = true,
              rangeVariableTypes = true,
            },
          },
        },
      },
      lua_ls = {
        settings = {
          Lua = {
            hint = {
              enable = true,
            },
          },
        },
      },
    },
  },
  diagnostics = {
    -- Disable virtual_text since it's redundant with lsp_lines.
    virtual_text = false,
  },
}
