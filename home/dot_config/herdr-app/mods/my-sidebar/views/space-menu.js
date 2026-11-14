// Right-click menus, opened as popups: a space's (Herdr's own items plus moving it
// between groups and pinning it) and a group heading's (rename, reorder, delete).
// ↑/↓ move, Enter runs, Esc closes.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, spaces, panes, exec } from "herdr";
import { spaceGroups, DEFAULT_GROUP } from "../git/groups.js";
import { spaceFolder } from "../git/checkouts.js";
import { isArchiving } from "../git/archive.js";
import { TEXT, Icon } from "./ui.js";

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: folder,
    on,
  });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

// The group name prompt, as its own popup.
function prompt(props) {
  openOverlay({ mod: "my-sidebar", kind: "dialog", width: 360, height: 130, props: { view: "group-prompt", ...props } });
}

function pickParent(space) {
  openOverlay({ mod: "my-sidebar", kind: "dialog", width: 380, height: 460, props: { view: "space-picker", space } });
}

// Through Worktrunk, so the repository's hooks run (worktree-new.js).
function newWorktree(space) {
  openOverlay({ mod: "my-sidebar", kind: "dialog", width: 440, height: 190, props: { view: "worktree-new", space } });
}

function confirmArchive(id) {
  const space = spaces().find((s) => s.id === id);
  const folder = space && spaceFolder(space, panes());
  if (!folder) return;
  openOverlay({
    mod: "my-sidebar",
    kind: "dialog",
    width: 400,
    height: 160,
    props: { view: "archive-confirm", space: id, folder, name: space.name },
  });
}

function worktreeDialog(args) {
  openOverlay({
    mod: "worktree",
    kind: "dialog",
    ...(args.action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }),
    props: args,
  });
}

export class SpaceMenu {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    spaceGroups.start(cx);
    const p = props();
    const space = p?.view === "space-menu" && spaces().find((s) => s.id === p.space);
    const folder = space && spaceFolder(space, panes());
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
  }

  // [label, icon, action, divider before]
  items() {
    const p = props() ?? {};
    return p.view === "group-menu" ? this.groupItems(p.group) : this.spaceItems(p.space);
  }

  spaceItems(id) {
    const group = spaceGroups.groupOf(id);
    const others = spaceGroups.names().filter((name) => name !== group?.name);
    const save = (promise) => promise.catch((e) => console.warn(`my-sidebar groups: ${e.message}`));
    return [
      ["Rename", "square-pen", () => run("space.rename", { id })],
      ...(this.git
        ? [
            ["New worktree", "git-branch", () => newWorktree(id)],
            ["Open worktree", "git-branch", () => worktreeDialog({ space: id, action: "open" })],
          ]
        : []),
      ...(this.git === "linked"
        ? [
            ["Remove worktree", "git-branch", () => worktreeDialog({ space: id, action: "remove" })],
            ...(isArchiving(id) ? [] : [["Archive worktree…", "archive", () => confirmArchive(id)]]),
          ]
        : []),
      ...others.map((name, n) => [
        `Move to ${name}`,
        "layers",
        () => save(spaceGroups.assign(id, name)),
        n === 0,
      ]),
      ...(group ? [[`Move to ${DEFAULT_GROUP}`, "layers", () => save(spaceGroups.assign(id, null)), !others.length]] : []),
      ["New group…", "plus", () => prompt({ mode: "new", space: id }), !others.length && !group],
      ...(group
        ? [
            spaceGroups.isPinned(id)
              ? [`Unpin from ${group.name}`, "pin-off", () => save(spaceGroups.setPinned(id, false))]
              : [`Pin in ${group.name}`, "pin", () => save(spaceGroups.setPinned(id, true))],
          ]
        : []),
      ["Set parent…", "git-branch", () => pickParent(id), true],
      ...(spaceGroups.parentOf(id)
        ? [["Remove parent", "x", () => save(spaceGroups.nest(id, null))]]
        : []),
      ["Close", "x", () => run("space.close", { id }), true],
    ];
  }

  groupItems(name) {
    const save = (promise) => promise.catch((e) => console.warn(`my-sidebar groups: ${e.message}`));
    const names = spaceGroups.names();
    const at = names.indexOf(name);
    return [
      ["Rename…", "square-pen", () => prompt({ mode: "rename", group: name })],
      ...(at > 0 ? [["Move up", "chevron-up", () => save(spaceGroups.move(name, -1))]] : []),
      ...(at >= 0 && at < names.length - 1 ? [["Move down", "chevron-down", () => save(spaceGroups.move(name, 1))]] : []),
      [`Delete (spaces go to ${DEFAULT_GROUP})`, "x", () => save(spaceGroups.remove(name)), true],
    ];
  }

  choose(i) {
    const item = this.items()[i];
    if (!item) return;
    closeOverlay(props()?.overlay);
    item[2]();
  }

  render() {
    const t = theme();
    const list = this.items();
    return v_flex()
      .id("my-sidebar-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(TEXT.menu)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map(([label, icon, , divided], i) =>
          v_flex()
            .when(i > 0 && Boolean(divided), (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(
              h_flex()
                .id(`mi-${i}`)
                .h(31)
                .px(8)
                .gap(9)
                .rounded(7)
                .items_center()
                .text_color(t.foreground)
                .when(i === this.at, (el) => el.bg(t.selected))
                .hover((s) => s.bg(t.hover))
                .on_click(() => this.choose(i))
                .child(Icon(icon, 14).text_color(t.muted))
                .child(div().flex_1().truncate().child(label)),
            ),
        ),
      );
  }
}
