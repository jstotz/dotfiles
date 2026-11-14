---
name: herdr
description: Control Herdr when the user asks to use it or manage work inside it — spaces or workspaces, tabs, panes, terminals, agents, layouts, or mods — in the Herdr desktop app (herdr-core) or the Herdr terminal app.
---

# Herdr

Two Herdr runtimes are installed, each with its own CLI and maintained agent
guide. Pick one before running any Herdr command, and do not mix their
commands or IDs.

1. If `HC_TERMINAL_ID` is set, you are in herdr-core, behind the desktop app.
2. Otherwise, if `HERDR_ENV` is `1`, you are in the Herdr terminal app.
3. Otherwise, use the desktop app, and tell the user you chose it because
   neither runtime's terminal markers were set.

Then load that runtime's guide from its installed binary and follow it:

- **Desktop app:** run `hc --skill` to start, read, message, and coordinate
  terminals and agents. Run `herdr-app --skill` as well when the request
  changes what the window shows (layouts, mods, keys, panels) or acts on
  spaces and tabs. The desktop app calls workspaces "spaces"; when the user
  says "workspace", they mean a space. Create spaces and tabs the user should
  see through `herdr-app` commands: a terminal started with `hc run` alone
  stays out of the window. The sidebar sorts spaces into named groups, with
  pinned spaces first; manage them with `herdr-space-group` (run it without
  arguments for usage). When the user names a group for a new space, put the
  space there using the ID that `space.new` returns. The Changes panel
  (reviewer) keeps GitHub-style Viewed marks per file; read and set them with
  `reviewer-viewed` (run it without arguments for usage), for example when the
  user asks to mark files matching a pattern as viewed.
- **Terminal app:** run `herdr --skill`.

Load each guide once per session and reuse it. Read it again only if it is no
longer in context or that runtime has been upgraded. Reading this entrypoint
alone does not count as loading a guide.

Do not keep a copied command reference here. If the selected binary or its
`--skill` output is unavailable, report that rather than guessing commands or
switching runtimes.
