local utils = require("astronvim.utils")

return {
  "nvim-treesitter/nvim-treesitter",
  opts = function(_, opts)
    opts.auto_install = true

    if not opts.ensure_installed then
      opts.ensure_installed = {}
    end
    utils.list_insert_unique(opts.ensure_installed, {
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
    })
  end,
}
