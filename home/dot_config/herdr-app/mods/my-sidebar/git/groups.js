// Space groups and nesting: named groups of spaces, each with spaces pinned to its
// top, and spaces nested under other spaces. Kept in a file rather than shared state
// so agents can change it too, with the herdr-space-group command. A space belongs
// to at most one group and has at most one parent; while nested, its group is unused.
//
// space-groups/groups.json in the app folder:
//   { "groups": [ { "name": "reviews", "spaces": ["sp…"], "pinned": ["sp…"] } ],
//     "parents": { "<child space>": "<parent space>" } }
// Group order is the file's order; pinned is a subset of spaces, in pin order.
import { readTextFile, writeTextFile, watchFolder, appHome, shared, setShared } from "herdr";
import * as fs from "fs/promises";

export const DEFAULT_GROUP = "default";
const folder = () => `${appHome()}/space-groups`;
const file = () => `${folder()}/groups.json`;

function parse(text) {
  let data = {};
  try {
    data = JSON.parse(text ?? "{}") ?? {};
  } catch {
    // A damaged file reads as empty.
  }
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .filter((g) => g && typeof g.name === "string" && g.name)
    .map((g) => ({
      name: g.name,
      spaces: Array.isArray(g.spaces) ? g.spaces.filter((s) => typeof s === "string") : [],
      pinned: Array.isArray(g.pinned) ? g.pinned.filter((s) => typeof s === "string") : [],
    }));
  const parents = {};
  for (const [child, parent] of Object.entries(data.parents ?? {}))
    if (typeof parent === "string" && parent !== child) parents[child] = parent;
  return { groups, parents };
}

// Whether `space` is `ancestor` or sits somewhere beneath it.
export function within(parents, space, ancestor) {
  const seen = new Set();
  for (let at = space; at && !seen.has(at); at = parents[at]) {
    if (at === ancestor) return true;
    seen.add(at);
  }
  return false;
}

export class SpaceGroups {
  constructor() {
    this.groups = [];
    this.parents = {};
    this.text = null;
  }

  // Reads the file, then rereads it whenever its folder changes.
  start(cx) {
    if (this.started) return;
    this.started = true;
    cx.spawn(async (cx) => {
      await this.reload(cx);
      for (;;) {
        try {
          await watchFolder(folder());
        } catch {
          // No folder yet: nothing to watch until the first group is made.
          await new Promise((resolve) => cx.timer.after(5000, resolve));
        }
        await this.reload(cx);
      }
    });
  }

  async reload(cx) {
    const text = await readTextFile(file()).catch(() => null);
    if (text === this.text) return;
    this.text = text;
    ({ groups: this.groups, parents: this.parents } = parse(text));
    cx?.notify();
  }

  groupOf(spaceId) {
    return this.groups.find((g) => g.spaces.includes(spaceId)) ?? null;
  }

  isPinned(spaceId) {
    return Boolean(this.groupOf(spaceId)?.pinned.includes(spaceId));
  }

  names() {
    return this.groups.map((g) => g.name);
  }

  // Applies `change` to a fresh copy of the file and writes it back only if no one
  // else wrote meanwhile; on a clash it rereads and tries again.
  async update(change, cx) {
    await fs.mkdir(folder(), { recursive: true }).catch(() => {});
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await readTextFile(file()).catch(() => null);
      const { groups, parents } = parse(before);
      change(groups, parents);
      const after = JSON.stringify({ groups, parents }, null, 2) + "\n";
      try {
        await writeTextFile(file(), after, before);
        this.text = after;
        this.groups = groups;
        this.parents = parents;
        // The sidebar and its menus are separate copies: a shared change redraws them all.
        setShared("my-sidebar.groups-rev", (shared("my-sidebar.groups-rev") ?? 0) + 1);
        cx?.notify();
        return;
      } catch {
        // Stale snapshot: someone else changed the file. Try again from theirs.
      }
    }
    throw new Error("space groups changed too often to save");
  }

  // Moves a space into `name` (made if new), or out of every group with null.
  assign(spaceId, name, cx) {
    return this.update((groups) => {
      for (const g of groups) {
        g.spaces = g.spaces.filter((s) => s !== spaceId);
        g.pinned = g.pinned.filter((s) => s !== spaceId);
      }
      if (!name || name === DEFAULT_GROUP) return;
      let group = groups.find((g) => g.name === name);
      if (!group) groups.push((group = { name, spaces: [], pinned: [] }));
      group.spaces.push(spaceId);
    }, cx);
  }

  setPinned(spaceId, pinned, cx) {
    return this.update((groups) => {
      const group = groups.find((g) => g.spaces.includes(spaceId));
      if (!group) return;
      group.pinned = group.pinned.filter((s) => s !== spaceId);
      if (pinned) group.pinned.push(spaceId);
    }, cx);
  }

  rename(from, to, cx) {
    return this.update((groups) => {
      const group = groups.find((g) => g.name === from);
      if (!group || !to || to === DEFAULT_GROUP) return;
      const into = groups.find((g) => g.name === to);
      if (!into) group.name = to;
      else {
        // Renaming onto an existing group merges the two.
        into.spaces.push(...group.spaces.filter((s) => !into.spaces.includes(s)));
        into.pinned.push(...group.pinned.filter((s) => !into.pinned.includes(s)));
        groups.splice(groups.indexOf(group), 1);
      }
    }, cx);
  }

  // Deleting a group sends its spaces back to default.
  remove(name, cx) {
    return this.update((groups) => {
      const at = groups.findIndex((g) => g.name === name);
      if (at >= 0) groups.splice(at, 1);
    }, cx);
  }

  parentOf(spaceId) {
    return this.parents[spaceId] ?? null;
  }

  // Nests a space under another, or unnests it with null. Refuses a loop.
  nest(spaceId, parentId, cx) {
    return this.update((_groups, parents) => {
      if (!parentId) return void delete parents[spaceId];
      if (within(parents, parentId, spaceId)) throw new Error("a space can't be its own parent or the parent of a space above it");
      parents[spaceId] = parentId;
    }, cx);
  }

  // One step earlier (-1) or later (+1) in the group order.
  move(name, step, cx) {
    return this.update((groups) => {
      const at = groups.findIndex((g) => g.name === name);
      const to = at + step;
      if (at < 0 || to < 0 || to >= groups.length) return;
      [groups[at], groups[to]] = [groups[to], groups[at]];
    }, cx);
  }
}

// Every space-group view in this mod shares one store, so a menu's change shows
// in the sidebar at once.
export const spaceGroups = new SpaceGroups();
