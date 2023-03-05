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
  -- -- Configure plugins
  plugins = {
    -- All other entries override the require("<key>").setup({...}) call for default plugins
    treesitter = {
      ensure_installed = {
        "bash",
        "c",
        "css",
        "diff",
        "dockerfile",
        "git_rebase",
        "gitcommit",
        "gitignore",
        "go",
        "gomod",
        "graphql",
        "hcl",
        "html",
        "javascript",
        "json",
        "lua",
        "make",
        "markdown",
        "ruby",
        "sql",
        "tsx",
        "typescript",
        "vim",
        "yaml",
      },
      auto_install = true,
    },

    ["mason-lspconfig"] = {
      ensure_installed = {
        "eslint",
        "golangci_lint_ls",
        "gopls",
        "sumneko_lua",
        "solargraph",
        "terraformls",
        "tsserver",
      },
    },

    ["null-ls"] = function(config)
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
    end,

    cmp = function(opts)
      local cmp = require "cmp"
      opts.mapping["<CR>"] = cmp.mapping.confirm { select = true }
      return opts
    end,
  },
}

return config
