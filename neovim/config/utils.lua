local utils = {}

function utils.git_root()
  return vim.fn.system("git rev-parse --show-toplevel")
end

function utils.git_root_relative_path(abs_path)
  return abs_path:gsub("^" .. utils.git_root() .. "/", "")
end

function utils.current_file_abs_path()
  return vim.fn.expand('%:p')
end

function utils.git_root_relative_path_current_file()
  return utils.git_root_relative_path(utils.current_file_abs_path())
end

return utils
