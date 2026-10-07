-- Uses the installed review.nvim/CodeDiff versions against a disposable repo.
-- Run: nvim --headless -u NONE -l tests/review-scope.test.lua
local config = vim.fn.getcwd() .. '/home/dot_config/nvim/lua'
package.path = config .. '/?.lua;' .. package.path
local plugins = vim.env.HOME .. '/.local/share/nvim/site/pack/core/opt/'
for _, name in ipairs({ 'codediff.nvim', 'review.nvim', 'nui.nvim' }) do
  vim.opt.runtimepath:append(plugins .. name)
end
local root = vim.fn.tempname()
vim.fn.mkdir(root, 'p')
vim.env.XDG_DATA_HOME = root .. '/data'
vim.env.HERDR_REVIEW_NVIM = nil
local function git(...)
  local args = { 'git', '-C', root }
  vim.list_extend(args, { ... })
  local result = vim.fn.system(args)
  assert(vim.v.shell_error == 0, result)
  return vim.trim(result)
end
local ok, err = xpcall(function()
  git('init', '-b', 'main')
  git('config', 'user.name', 'Review test')
  git('config', 'user.email', 'review@example.test')
  vim.fn.writefile({ 'base' }, root .. '/committed.txt')
  vim.fn.writefile({ 'base' }, root .. '/local.txt')
  git('add', '.')
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'base')
  git('switch', '-c', 'feature')
  vim.fn.writefile({ 'branch edit' }, root .. '/committed.txt')
  git('add', '.')
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'feature')
  vim.fn.writefile({ 'local edit' }, root .. '/local.txt')
  vim.cmd.cd(root)
  vim.g.mapleader = ' '
  vim.g.maplocalleader = ','
  vim.cmd('runtime plugin/codediff.lua')
  require('codediff').setup({})
  require('review').setup({ export = { clipboard = false, on_export = function() error('scope switch exported comments') end } })
  local scope = require('config.review-scope')
  scope.setup()
  local lifecycle = require('codediff.ui.lifecycle')
  local function await_view(branch)
    assert(vim.wait(5000, function()
      local s = lifecycle.get_session(vim.api.nvim_get_current_tabpage())
      return s and s.panel and (s.panel.data.source_revisions ~= nil) == branch
    end, 20), 'review scope did not open')
    vim.wait(250, function() return false end)
    return vim.api.nvim_get_current_tabpage()
  end
  -- Simulate the existing Herdr +Review startup, then exercise the new bindings.
  require('review').open()
  local local_tab = await_view(false)
  require('review.store').add('local.txt', 1, 'note', 'keep this comment')
  scope.toggle()
  local branch_tab = await_view(true)
  assert(branch_tab ~= local_tab)
  local files = lifecycle.get_session(branch_tab).panel.data.status_result.unstaged
  local paths = {}
  for _, file in ipairs(files) do paths[file.path] = true end
  assert(paths['committed.txt'] and paths['local.txt'], 'branch scope must include both changes')
  assert(vim.fn.maparg(',m', 'n') ~= '', 'local toggle mapping missing')
  local count = #vim.api.nvim_list_tabpages()
  for _ = 1, 3 do
    scope.toggle(); assert(vim.api.nvim_get_current_tabpage() == local_tab)
    scope.toggle(); assert(vim.api.nvim_get_current_tabpage() == branch_tab)
  end
  scope.open('branch'); assert(vim.api.nvim_get_current_tabpage() == branch_tab)
  scope.open('uncommitted'); assert(vim.api.nvim_get_current_tabpage() == local_tab)
  assert(#vim.api.nvim_list_tabpages() == count, 'toggle duplicated tabs')
  assert(require('review.store').count() == 1, 'toggle lost comments')
  print('PASS: branch/local scopes, reusable tabs, local mapping, preserved comments')
end, debug.traceback)
vim.cmd.cd('/tmp')
vim.fn.delete(root, 'rf')
if not ok then error(err) end
