require("diffview").setup({})
require("codediff").setup({})
-- Code review: closing exports comments to the clipboard and archives them.
require("review").setup({
  keymaps = { send_sidekick = false },
  export = { clipboard = true, on_export = require("config.review-export").send },
})
require("config.review-export").setup()
vim.keymap.set("n", "<leader>gr", "<cmd>Review<cr>", { desc = "Review with comments" })
require("neogit").setup({
  integrations = { mini_pick = true, diffview = true },
  -- Preserve smart-splits navigation in the status view.
  mappings = { status = { ["<c-j>"] = false, ["<c-k>"] = false } },
})
vim.keymap.set("n", "<leader>gg", "<cmd>Neogit<cr>", { desc = "Open Neogit" })
vim.keymap.set("n", "<leader>gd", "<cmd>DiffviewOpen<cr>", { desc = "Review working diff" })
vim.keymap.set("n", "<leader>gH", function()
  vim.cmd("DiffviewFileHistory " .. vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)))
end, { desc = "File history" })
