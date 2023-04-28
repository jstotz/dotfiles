return {
  colorscheme = "catppuccin",
  lsp = {
    formatting = {
      timeout_ms = 10000,
    },
    diagnostics = {
      timeout_ms = 10000,
    },
  },
  diagnostics = {
    -- Disable virtual_text since it's redundant with lsp_lines.
    virtual_text = false,
  },
}
