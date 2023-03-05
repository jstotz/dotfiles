return function(config)
  local null_ls = require "null-ls"

  -- Check supported formatters and linters
  -- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/formatting
  -- https://github.com/jose-elias-alvarez/null-ls.nvim:/tree/main/lua/null-ls/builtins/diagnostics
  config.sources = {
    null_ls.builtins.formatting.prettierd.with {
      filetypes = { "ruby" },
    },
    null_ls.builtins.formatting.fixjson,
    null_ls.builtins.diagnostics.jsonlint
  }
  return config
end
