// Names a group: a new one for a space (mode "new"), or a new name for one (mode
// "rename"). Enter saves, Esc cancels.
import { div } from "gpui-kit";
import { v_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme } from "herdr";
import { spaceGroups, DEFAULT_GROUP } from "../git/groups.js";
import { TEXT } from "./ui.js";

export class GroupPrompt {
  init(_props, cx) {
    const p = props() ?? {};
    this.error = "";
    this.input = InputState.new({ value: p.mode === "rename" ? p.group : "", placeholder: "group name" });
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
    spaceGroups.start(cx);
  }

  submit(cx) {
    const p = props() ?? {};
    const name = this.input.value().trim();
    if (!name || name === DEFAULT_GROUP) {
      this.error = name ? `"${DEFAULT_GROUP}" holds the ungrouped spaces; pick another name.` : "Type a name.";
      cx.notify();
      return;
    }
    const saving = p.mode === "rename" ? spaceGroups.rename(p.group, name) : spaceGroups.assign(p.space, name);
    saving
      .then(() => closeOverlay(p.overlay))
      .catch((e) => {
        this.error = String(e.message ?? e);
        cx.notify();
      });
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    return v_flex()
      .id("group-prompt")
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
      .child(div().font_semibold().text_color(t.foreground).child(p.mode === "rename" ? `Rename ${p.group}` : "New group"))
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
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).child(this.error)));
  }
}
