local M = {}

local function session(tab)
  return require("codediff.ui.lifecycle").get_session(tab)
end

local function scope(tab)
  local s = session(tab)
  if not s or not s.panel or s.panel.name ~= "explorer" then return nil end
  local data = s.panel.data
  if data.pathspec then return nil end
  if not data.source_revisions then return "uncommitted" end
  -- A revision-to-working-tree review includes both committed and local work.
  if data.source_revisions.modified == "WORKING" then return "branch" end
end

function M.open(wanted)
  local current = vim.api.nvim_get_current_tabpage()
  local s = session(current)
  local cwd = s and s.git_root or vim.fn.getcwd()
  local root = vim.fn.systemlist({ "git", "-C", cwd, "rev-parse", "--show-toplevel" })[1]
  if vim.v.shell_error ~= 0 then
    vim.notify("Review requires a Git repository", vim.log.levels.WARN)
    return
  end
  -- Keep one view of each scope. Switching tabs neither exports nor clears
  -- comments, and retains the selected file and scroll position in each view.
  for _, tab in ipairs(vim.api.nvim_list_tabpages()) do
    local candidate = session(tab)
    if candidate and candidate.git_root == root and scope(tab) == wanted then
      vim.api.nvim_set_current_tabpage(tab)
      return
    end
  end
  if wanted == "uncommitted" then
    require("review").open()
  else
    local branch = vim.fn.systemlist({ "git", "-C", root, "symbolic-ref", "--quiet", "--short", "HEAD" })[1]
    if vim.v.shell_error ~= 0 or not branch then
      vim.notify("Branch review requires a checked-out branch", vim.log.levels.WARN)
      return
    end
    require("review").open_branch(branch)
  end
end

function M.toggle()
  M.open(scope(vim.api.nvim_get_current_tabpage()) == "branch" and "uncommitted" or "branch")
end

function M.setup()
  vim.keymap.set("n", "<leader>gr", function() M.open("uncommitted") end, { desc = "Review uncommitted changes" })
  vim.keymap.set("n", "<leader>gb", function() M.open("branch") end, { desc = "Review entire branch" })
  vim.keymap.set("n", "<leader>gt", M.toggle, { desc = "Toggle review scope" })
  local group = vim.api.nvim_create_augroup("ReviewScopeKeys", { clear = true })
  vim.api.nvim_create_autocmd({ "BufEnter", "TabEnter" }, {
    group = group,
    callback = function()
      if scope(vim.api.nvim_get_current_tabpage()) then
        vim.keymap.set("n", "<localleader>m", M.toggle, { buffer = true, desc = "Toggle review scope" })
      else
        pcall(vim.keymap.del, "n", "<localleader>m", { buffer = true })
      end
    end,
  })
end

return M
