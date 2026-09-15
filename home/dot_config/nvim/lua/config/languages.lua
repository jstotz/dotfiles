-- Discover the language server on PATH; it prefers project-local TypeScript.
vim.lsp.enable("ts_ls")
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("NativeCompletion", { clear = true }),
  callback = function(event)
    local client = assert(vim.lsp.get_client_by_id(event.data.client_id))
    if client:supports_method("textDocument/completion") then
      vim.lsp.completion.enable(true, client.id, event.buf, { autotrigger = true })
    end
    vim.keymap.set("n", "gd", vim.lsp.buf.definition, { buffer = event.buf, desc = "Go to definition" })
    vim.keymap.set("n", "<leader>lr", vim.lsp.buf.rename, { buffer = event.buf, desc = "Rename symbol" })
    vim.keymap.set({ "n", "x" }, "<leader>la", vim.lsp.buf.code_action, { buffer = event.buf, desc = "Code action" })
  end,
})

local conform = require("conform")
conform.setup({
  -- The prettier formatter searches node_modules/.bin before PATH.
  formatters_by_ft = {
    typescript = { "prettier" },
    typescriptreact = { "prettier" },
    javascript = { "prettier" },
    javascriptreact = { "prettier" },
    json = { "prettier" },
    jsonc = { "prettier" },
  },
  format_on_save = function(bufnr)
    if vim.g.autoformat ~= false and vim.b[bufnr].autoformat ~= false then
      return { timeout_ms = 2000, lsp_format = "never" }
    end
  end,
})
vim.keymap.set({ "n", "x" }, "<leader>lf", function()
  conform.format({ async = true, lsp_format = "never" })
end, { desc = "Format" })
vim.keymap.set("n", "<leader>uf", function()
  vim.b.autoformat = vim.b.autoformat == false
  vim.notify("Buffer autoformat: " .. tostring(vim.b.autoformat))
end, { desc = "Toggle buffer autoformat" })
vim.keymap.set("n", "<leader>uF", function()
  vim.g.autoformat = vim.g.autoformat == false
  vim.notify("Global autoformat: " .. tostring(vim.g.autoformat))
end, { desc = "Toggle global autoformat" })

local parsers = { "typescript", "tsx", "javascript", "jsdoc", "json", "diff" }
-- Install once explicitly with :TSInstall typescript tsx javascript jsdoc json diff.
-- No network access or compilation when opening a file.
vim.api.nvim_create_autocmd("FileType", {
  group = vim.api.nvim_create_augroup("SyntaxHighlighting", { clear = true }),
  pattern = { "typescript", "typescriptreact", "javascript", "javascriptreact", "json", "jsonc", "diff" },
  callback = function(event)
    local lang = vim.treesitter.language.get_lang(vim.bo[event.buf].filetype)
    if lang and vim.treesitter.language.add(lang) then vim.treesitter.start(event.buf, lang) end
  end,
})
return { parsers = parsers }
