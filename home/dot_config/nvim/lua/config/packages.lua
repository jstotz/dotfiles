-- Native package management; nvim-pack-lock.json records tested revisions.
-- Update with :lua vim.pack.update(), then capture the lockfile with chezmoi re-add.
vim.api.nvim_create_autocmd("PackChanged", {
  group = vim.api.nvim_create_augroup("UpdateSyntaxParsers", { clear = true }),
  callback = function(event)
    if event.data.spec.name == "nvim-treesitter" and event.data.kind == "update" then
      vim.cmd.packadd("nvim-treesitter")
      require("nvim-treesitter").update()
    end
  end,
})

-- Template highlighting is separate from chezmoi.nvim's editing commands.
-- Resolve the configured source directory, including chezmoi's source root.
vim.g["chezmoi#use_external"] = 1
vim.g["chezmoi#use_tmp_buffer"] = true
vim.pack.add({
  "https://github.com/alker0/chezmoi.vim",
  { src = "https://github.com/nvim-mini/mini.nvim", version = "stable" },
  { src = "https://github.com/catppuccin/nvim", name = "catppuccin" },
  "https://github.com/neovim/nvim-lspconfig",
  "https://github.com/stevearc/conform.nvim",
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
  "https://github.com/nvim-lua/plenary.nvim", -- Diffview and chezmoi dependency
  "https://github.com/xvzc/chezmoi.nvim",
  "https://github.com/sindrets/diffview.nvim",
  "https://github.com/NeogitOrg/neogit",
  -- Keep these aligned with run_onchange_after_install-herdr-plugins.sh.
  { src = "https://github.com/mrjones2014/smart-splits.nvim", version = "ec76708f1617ef9e2ac353357fe52d2c997a0f06" },
  { src = "https://github.com/ChmaraX/herdr-nvim", version = "0450dc7b4c40c986052541c00dba5cdcd1be7ac6" },
}, { confirm = false })

require("catppuccin").setup({ flavour = "mocha", integrations = { neogit = true, mini = { enabled = true } } })
vim.cmd.colorscheme("catppuccin")
