// Confirms archiving a worktree space. Enter or Archive archives, Esc or Cancel doesn't.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme } from "herdr";
import { requestArchive } from "../git/archive.js";
import { TEXT } from "./ui.js";

export class ArchiveConfirm {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(300, () => this.handle.focus());
  }

  archive() {
    const p = props();
    requestArchive(p.space, p.folder, p.name);
    closeOverlay(p.overlay);
  }

  button(id, label, primary, onClick, t) {
    return div()
      .id(id)
      .px(12)
      .h(28)
      .flex()
      .items_center()
      .rounded(6)
      .cursor_pointer()
      .when(primary, (el) => el.bg(t.blocked).text_color("#ffffff").hover((s) => s.opacity(0.9)))
      .when(!primary, (el) => el.border(1).border_color(t.border).text_color(t.foreground).hover((s) => s.bg(t.hover)))
      .on_click(onClick)
      .child(label);
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    return v_flex()
      .id("archive-confirm")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") closeOverlay(p.overlay);
        else if (e.key === "enter") this.archive();
        else return;
        cx.stop_propagation();
      })
      .size_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(TEXT.body)
      .child(div().font_semibold().text_color(t.foreground).child(`Archive ${p.name}?`))
      .child(
        div()
          .text_color(t.muted)
          .child("Its agents and terminals will stop, and the worktree will be archived and removed."),
      )
      .child(div().flex_1())
      .child(
        h_flex()
          .gap(8)
          .justify_end()
          .child(this.button("archive-cancel", "Cancel", false, () => closeOverlay(p.overlay), t))
          .child(this.button("archive-ok", "Archive", true, () => this.archive(), t)),
      );
  }
}
