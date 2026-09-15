local splits = require("smart-splits")
splits.setup({})
for key, direction in pairs({ h = "left", j = "down", k = "up", l = "right" }) do
  vim.keymap.set("n", "<C-" .. key .. ">", splits["move_cursor_" .. direction], { desc = "Navigate " .. direction })
end
for key, direction in pairs({ Left = "left", Down = "down", Up = "up", Right = "right" }) do
  vim.keymap.set("n", "<C-" .. key .. ">", splits["resize_" .. direction], { desc = "Resize " .. direction })
end

-- The sidebar calls setup again on VimEnter; own these maps here.
local sidebar = require("herdr-nvim")
sidebar.setup({ keymaps = false })
vim.keymap.set("n", "<leader>ac", sidebar.comment_line, { desc = "Comment line to agent" })
vim.keymap.set("x", "<leader>ac", sidebar.comment_selection, { desc = "Comment selection to agent" })
vim.keymap.set("n", "<leader>al", sidebar.list_comments, { desc = "List agent comments" })
vim.keymap.set("n", "<leader>as", function() sidebar.send_all({ submit = false }) end, { desc = "Paste comments to agent" })
vim.keymap.set("n", "<leader>aS", function() sidebar.send_all({ submit = true }) end, { desc = "Send comments to agent" })

-- The sidebar daemon survives toggling, but its UI gets a new Herdr pane.
-- Match the attached UI's PID rather than trusting focus or the old ID.
local function refresh_pane(chan)
  if vim.env.HERDR_ENV ~= "1" then return end
  local client = vim.api.nvim_get_chan_info(chan).client or {}
  local pid = (client.attributes or {}).pid
  if client.name ~= "nvim-tui" or not pid then return end
  local function query(args)
    local command = { vim.env.HERDR_BIN_PATH or "herdr" }
    vim.list_extend(command, args)
    local result = vim.system(command, { text = true }):wait(2000)
    if result.code ~= 0 then return end
    local ok, decoded = pcall(vim.json.decode, result.stdout)
    if ok then return decoded.result end
  end
  local result = query({ "pane", "list", "--workspace", vim.env.HERDR_WORKSPACE_ID })
  for _, pane in ipairs(result and result.panes or {}) do
    if pane.tab_id == vim.env.HERDR_TAB_ID then
      local info = query({ "pane", "process-info", "--pane", pane.pane_id })
      for _, process in ipairs(info and info.process_info.foreground_processes or {}) do
        if process.pid == pid then
          vim.env.HERDR_PANE_ID = pane.pane_id
          return
        end
      end
    end
  end
end
vim.api.nvim_create_autocmd("UIEnter", {
  group = vim.api.nvim_create_augroup("HerdrSidebarPaneIdentity", { clear = true }),
  callback = function()
    local chan = vim.v.event.chan
    vim.schedule(function() refresh_pane(chan) end)
  end,
})
for _, ui in ipairs(vim.api.nvim_list_uis()) do refresh_pane(ui.chan) end
