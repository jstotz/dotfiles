-- Run from the repository root: nvim --headless -u NONE -l tests/review-export.test.lua
package.path = './home/dot_config/nvim/lua/?.lua;' .. package.path
local queue, sent, choices, notices = {}, {}, {}, {}
local available, fail_send = {}, false
vim.schedule = function(fn) table.insert(queue, fn) end
vim.notify = function(message) table.insert(notices, message) end
package.loaded['herdr-nvim.agents'] = {
  list = function() return available end,
  display = function(a) return a.pane_id end,
}
package.loaded['herdr-nvim.dispatch'] = {
  send = function(pane, text, opts)
    assert(opts.submit == false, 'Must never submit')
    if fail_send then return false, 'test failure' end
    table.insert(sent, {pane = pane, text = text})
    return true
  end,
}
package.loaded['herdr-nvim.ui'] = {
  pick_agent = function(list, callback) table.insert(choices, {list = list, callback = callback}) end,
}
local export = dofile('home/dot_config/nvim/lua/config/review-export.lua')
local function flush()
  while #queue > 0 do table.remove(queue, 1)() end
end
local a, b = {pane_id = 'a', kind = 'codex'}, {pane_id = 'b', kind = 'claude'}
vim.env.HERDR_ENV = nil
export.send('outside')
assert(#queue == 0)
vim.env.HERDR_ENV = '1'
export.send('no agent'); flush()
assert(#sent == 0 and #notices == 1)
available = {a}
export.send('first')
assert(#sent == 0, 'Delivery must wait until review tab closes')
flush()
assert(#sent == 1 and sent[1].pane == 'a' and sent[1].text == 'first')
export.send('first'); flush()
assert(#sent == 1, 'Export then close must not duplicate feedback')
available = {a, b}
export.send('pick'); flush()
assert(#choices == 1 and #sent == 1)
-- Cancel: the upstream picker doesn't call its callback. Retrying must work.
export.send('pick'); flush()
assert(#choices == 2)
choices[2].callback(b)
assert(#sent == 2 and sent[2].pane == 'b')
export.send('disappeared'); flush()
available = {a}
choices[3].callback(b)
assert(#sent == 2)
fail_send = true
export.send('retry'); flush()
assert(#sent == 2)
fail_send = false
export.send('retry'); flush()
assert(#sent == 3)
export.send('queued twice'); export.send('queued twice'); flush()
assert(#sent == 4)
print('PASS: deferred delivery, agent selection, cancellation, missing agents, retries, and deduplication')

local focused, quit = {}, 0
vim.system = function(args)
  assert(args[2] == 'agent' and args[3] == 'focus')
  table.insert(focused, args[4])
  return {wait = function() return {code = 0} end}
end
vim.cmd = function(command) assert(command == 'qa'); quit = quit + 1 end
local close_text = 'close test'
package.loaded.review = {close = function() if close_text then export.send(close_text) end end}
vim.env.HERDR_REVIEW_NVIM = nil
export.setup()
assert(vim.fn.maparg('q', 'n') == '', 'Ordinary Neovim must retain its q behavior')
vim.env.HERDR_REVIEW_NVIM = '1'
export.setup()
available = {a}
package.loaded.review.close()
assert(quit == 0)
flush()
assert(quit == 1 and focused[1] == 'a')
-- Closing after an explicit export should focus the same recipient, not resend.
export.send('export then close'); flush()
local count = #sent
close_text = 'export then close'
package.loaded.review.close(); flush()
assert(#sent == count and quit == 2)
close_text = nil
package.loaded.review.close(); flush()
assert(quit == 3)
close_text = 'failed close'
fail_send = true
package.loaded.review.close(); flush()
assert(quit == 3, 'Do not exit after failed delivery')
fail_send = false
available = {}
package.loaded.review.close(); flush()
assert(quit == 4, 'Clipboard-only review can close')
print('PASS: close focuses recipient and exits; export stays open; failed delivery stays open')
local fallback = vim.fn.maparg('q', 'n', false, true)
assert(fallback.buffer == 1 and type(fallback.callback) == 'function')
local sent_before = #sent
fallback.callback()
assert(quit == 5 and #sent == sent_before, 'Empty review must exit without exporting')
print('PASS: dedicated startup buffer closes with q even without a review session')
vim.notify('No changes to show', vim.log.levels.INFO)
flush()
local screen = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
assert(screen:find('No changes to review', 1, true))
assert(screen:find('Press q to close this window.', 1, true))
assert(vim.bo.buftype == 'nofile' and not vim.bo.modifiable and not vim.bo.modified)
local notice_count = #notices
vim.notify('An unrelated message')
assert(#notices == notice_count + 1)
print('PASS: empty review displays a read-only result screen; unrelated notifications pass through')
