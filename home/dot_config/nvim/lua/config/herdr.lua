local splits = require("smart-splits")
splits.setup({})
for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
  vim.keymap.set("n", "<C-" .. key .. ">", splits["move_cursor_" .. direction], { desc = "Navigate " .. direction })
end
for key, direction in pairs({ Left = "left", Down = "down", Up = "up", Right = "right" }) do
  vim.keymap.set("n", "<C-" .. key .. ">", splits["resize_" .. direction], { desc = "Resize " .. direction })
end
