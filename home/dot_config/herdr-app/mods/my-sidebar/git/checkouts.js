// Reading a space's checkout from Git, with no view state.
import { exec } from "herdr";

const basename = (path) => path.replace(/\/+$/, "").split("/").pop();

// The first terminal defines a space's checkout, not whichever pane is focused.
// Pass a panes() snapshot: each API call copies the full pane list.
export function spaceFolder(space, paneList) {
  const tabIDs = new Set((space.tabs ?? []).map((tab) => tab.id));
  return paneList.find((pane) => tabIDs.has(pane.tab) && pane.cwd)?.cwd || space.folder;
}

export const checkoutKey = (space, paneList) =>
  JSON.stringify([space.machine ?? null, spaceFolder(space, paneList)]);

// Branch, ahead/behind and repository, or null if this isn't a repository.
// Throws when Git couldn't be asked, so the caller keeps what it knew.
export async function readCheckout(cwd, on) {
  // Reading status must not touch the index or fsmonitor: our own writes would
  // wake the Git-folder watch and create a refresh loop.
  const status = await exec(
    "git",
    ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--branch"],
    { cwd, on },
  );
  if (status.code !== 0) {
    if (/not a git repository/i.test(status.stderr)) return null;
    throw new Error("Cannot read status");
  }

  // The repo's own .git folder names it; a worktree's top differs from it.
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd,
    on,
  });
  if (top.code !== 0 || common.code !== 0) throw new Error("Cannot read repository metadata");

  const repo = common.stdout.trim();
  const info = {
    name: repo.endsWith("/.git")
      ? basename(repo.slice(0, -5))
      : basename(repo).replace(/\.git$/, ""),
    branch: null,
    ahead: 0,
    behind: 0,
    repo: JSON.stringify([on, repo]),
    linked: repo !== `${top.stdout.trim()}/.git`,
  };
  for (const line of status.stdout.split("\n")) {
    if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
    else if (line.startsWith("# branch.ab ")) {
      const [ahead, behind] = line.slice(12).split(" ");
      info.ahead = Math.abs(parseInt(ahead, 10)) || 0;
      info.behind = Math.abs(parseInt(behind, 10)) || 0;
    }
  }
  return info;
}
