// New worktree through Worktrunk, so the repository's hooks run: asks for a
// branch, runs `wt -C <checkout> switch --create <branch> --no-cd --format json`
// in the space's checkout, then opens the new checkout as a space named after
// the branch, in the same group as the space it came from. A failure keeps the
// dialog open with wt's message. Enter creates, Esc closes.
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, spaces, panes, exec, run } from "herdr";
import { spaceFolder } from "../git/checkouts.js";
import { spaceGroups } from "../git/groups.js";
import { TEXT, Icon } from "./ui.js";

export class WorktreeNew {
  init(_props, cx) {
    this.busy = false;
    this.error = "";
    this.input = InputState.new({ placeholder: "branch name" });
    this.input.on("submit", (_e, cx) => this.create(cx));
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
    spaceGroups.start(cx);
  }

  create(cx) {
    const p = props() ?? {};
    const branch = this.input.value().trim();
    if (this.busy) return;
    if (!branch || branch.startsWith("-") || /\s/.test(branch)) {
      this.error = branch ? "A branch name has no spaces and doesn't start with -." : "Type a branch name.";
      return cx.notify();
    }
    const space = spaces().find((s) => s.id === p.space);
    const folder = space && spaceFolder(space, panes());
    if (!folder) {
      this.error = "Can't tell which checkout this space is in.";
      return cx.notify();
    }
    this.busy = true;
    this.error = "";
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("wt", ["-C", folder, "switch", "--create", branch, "--no-cd", "--format", "json"], {
          on: space.machine,
          timeout: 600000,
        });
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").slice(-8).join("\n") || `wt exited ${r.code}`);
        const made = JSON.parse(r.stdout.trim().split("\n").pop());
        const group = spaceGroups.groupOf(p.space)?.name;
        run("space.new", { name: made.branch ?? branch, folder: made.path, ...(space.machine ? { machine: space.machine } : {}) });
        // The new space's id, to put it in the group: the one at that folder.
        for (let i = 0; group && i < 40; i++) {
          const added = spaces().find((s) => s.folder === made.path);
          if (added) {
            await spaceGroups.assign(added.id, group);
            break;
          }
          await cx.sleep(100);
        }
        closeOverlay(p.overlay);
      } catch (e) {
        this.busy = false;
        this.error = String(e.message ?? e);
        cx.notify();
      }
    });
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const name = spaces().find((s) => s.id === p.space)?.name ?? "this space";
    return v_flex()
      .id("worktree-new")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key !== "escape") return;
        cx.stop_propagation();
        closeOverlay(p.overlay);
      })
      .size_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(TEXT.body)
      .child(div().font_semibold().text_color(t.foreground).child(`New worktree from ${name}`))
      .child(
        Input.new(this.input)
          .h(32)
          .px(10)
          .items_center()
          .rounded(6)
          .border(1)
          .border_color(t.accent)
          .bg(t.background)
          .text_color(t.foreground),
      )
      .when(this.busy, (el) =>
        el.child(
          h_flex()
            .gap(8)
            .items_center()
            .text_color(t.muted)
            .child(Icon("spinner", 12).text_color(t.working).spin(900))
            .child("Creating with Worktrunk (its hooks run first)…"),
        ),
      )
      .when(!this.busy && !this.error, (el) =>
        el.child(div().text_color(t.dim).child("Worktrunk creates it from the default branch and runs the repo's hooks.")),
      )
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).whitespace_normal().child(this.error)));
  }
}
