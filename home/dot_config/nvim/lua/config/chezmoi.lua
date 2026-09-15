-- Edit source files through the picker; deployment remains explicit.
require("chezmoi").setup({ edit = { watch = false, force = false } })
vim.keymap.set("n", "<leader>fc", function()
  require("chezmoi.pick").mini(nil, { "--path-style", "absolute", "--include", "files", "--exclude", "externals" })
end, { desc = "Find chezmoi files" })
