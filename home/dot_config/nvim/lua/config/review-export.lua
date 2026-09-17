local M = {}
local delivered = {}
local closing = false
local export_pending = false

local function finish(agent)
  if agent then
    local result = vim.system({ vim.env.HERDR_BIN_PATH or "herdr", "agent", "focus", agent.pane_id }, { text = true }):wait()
    if result.code ~= 0 then
      vim.notify("Could not focus the agent: " .. (result.stderr or ""), vim.log.levels.ERROR)
      return
    end
  end
  -- Exit only the dedicated review process, and never discard edited buffers.
  vim.cmd("qa")
end

function M.setup()
  if vim.env.HERDR_REVIEW_NVIM ~= "1" then return end
  local review = require("review")
  local close = review.close
  review.close = function()
    closing, export_pending = true, false
    local ok, err = pcall(close)
    closing = false
    if not ok then error(err) end
    if not export_pending then vim.schedule(function() finish() end) end
  end
end

local function notify(message, level)
  vim.notify(message, level or vim.log.levels.INFO, { title = "Code Review" })
end

function M.send(markdown)
  -- review.nvim has already copied the export to the clipboard. Keep that
  -- fallback when outside Herdr, when selection is cancelled, or on failure.
  if vim.env.HERDR_ENV ~= "1" then return end
  local scope = vim.fn.getcwd()
  local close_after = closing
  if close_after then export_pending = true end

  -- Closing a review closes its Neovim tab synchronously. Open the picker only
  -- after that finishes so it isn't destroyed along with the review window.
  vim.schedule(function()
    if delivered[scope] and delivered[scope].markdown == markdown then
      if close_after then finish(delivered[scope].agent) end
      return
    end
    local agents = require("herdr-nvim.agents")
    local list, err = agents.list()
    if not list or #list == 0 then
      notify(err or "No agent in this workspace; comments are on the clipboard", vim.log.levels.WARN)
      if close_after and list then finish() end
      return
    end

    local function send(agent)
      if delivered[scope] and delivered[scope].markdown == markdown then
        if close_after then finish(delivered[scope].agent) end
        return
      end
      -- The picker can stay open while an agent exits. Check again before
      -- writing to its terminal, rather than pasting into an abandoned shell.
      local current, list_error = agents.list()
      local found = false
      for _, candidate in ipairs(current or {}) do
        if candidate.pane_id == agent.pane_id and candidate.kind == agent.kind then
          found = true
          break
        end
      end
      if not found then
        notify(list_error or "Agent is no longer available; comments are on the clipboard", vim.log.levels.WARN)
        return
      end
      local ok, send_error = require("herdr-nvim.dispatch").send(agent.pane_id, markdown, { submit = false })
      if not ok then
        notify((send_error or "Delivery failed") .. "; comments are on the clipboard", vim.log.levels.ERROR)
        return
      end
      delivered[scope] = { markdown = markdown, agent = agent }
      notify("Comments pasted to " .. agents.display(agent) .. " (not submitted)")
      if close_after then finish(agent) end
    end

    if #list == 1 then
      send(list[1])
    else
      require("herdr-nvim.ui").pick_agent(list, send)
    end
  end)
end

return M
