return {
  "nvim-neorg/neorg",
  build = ":Neorg sync-parsers",
  dependencies = { "nvim-lua/plenary.nvim", "nvim-neorg/neorg-telescope" },
  event = "VeryLazy",
  opts = {
    load = {
      ["core.integrations.telescope"] = {},
      ["core.defaults"] = {},       -- Loads default behaviour
      ["core.norg.concealer"] = {}, -- Adds pretty icons to your documents
      ["core.keybinds"] = {},       -- Adds default keybindings
      ["core.norg.completion"] = {
        config = {
          engine = "nvim-cmp",
        },
      },                          -- Enables support for completion plugins
      ["core.norg.journal"] = {}, -- Enables support for the journal module
      ["core.norg.dirman"] = {    -- Manages Neorg workspaces
        config = {
          workspaces = {
            personal = "~/Notes/Personal",
            work = "~/Notes/Work",
          },
          default_workspace = "work",
        },
      },
    },
  },
}
