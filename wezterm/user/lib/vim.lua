local module = {}

function module.is_vim_pane(pane)
  return pane:get_title():lower():find("n?vim") ~= nil
end

module.vim_directions = {
  Left = "h",
  Right = "l",
  Up = "j",
  Down = "k",
}

return module
