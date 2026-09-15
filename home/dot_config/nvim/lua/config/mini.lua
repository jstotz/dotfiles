-- Common defaults; explicit preferences in options.lua take precedence.
require("mini.basics").setup({
  mappings = { basic = false, option_toggle_prefix = "", windows = false, move_with_alt = false },
})
require("mini.surround").setup()
require("mini.ai").setup()
require("mini.diff").setup()
vim.keymap.set("n", "<leader>go", function()
  MiniDiff.toggle_overlay()
end, { desc = "Toggle diff overlay" })

require("mini.icons").setup()
MiniIcons.mock_nvim_web_devicons()
require("mini.statusline").setup()
require("mini.pick").setup()
require("mini.extra").setup()
require("mini.files").setup()
vim.ui.select = MiniPick.ui_select

vim.keymap.set("n", "<leader>ff", MiniPick.builtin.files, { desc = "Find files" })
vim.keymap.set("n", "<leader>fw", MiniPick.builtin.grep_live, { desc = "Search project text" })
vim.keymap.set("n", "<leader>fb", MiniPick.builtin.buffers, { desc = "Find buffers" })
vim.keymap.set("n", "<leader>fo", function()
  MiniExtra.pickers.oldfiles({ current_dir = true })
end, { desc = "Recent project files" })
vim.keymap.set("n", "<leader>fh", MiniPick.builtin.help, { desc = "Search help" })
vim.keymap.set("n", "<leader>ld", MiniExtra.pickers.diagnostic, { desc = "Find diagnostics" })
vim.keymap.set("n", "-", function()
  local file = vim.api.nvim_buf_get_name(0)
  MiniFiles.open(vim.uv.fs_stat(file) and file or vim.fn.getcwd())
end, { desc = "Browse directory" })

require("mini.clue").setup({
  triggers = { { mode = { "n", "x" }, keys = "<Leader>" } },
  clues = {
    { mode = { "n", "x" }, keys = "<Leader>a", desc = "+Agent" },
    { mode = "n", keys = "<Leader>f", desc = "+Files" },
    { mode = "n", keys = "<Leader>g", desc = "+Git" },
    { mode = { "n", "x" }, keys = "<Leader>l", desc = "+LSP" },
    { mode = "n", keys = "<Leader>u", desc = "+Toggles" },
  },
  window = { delay = 300 },
})
