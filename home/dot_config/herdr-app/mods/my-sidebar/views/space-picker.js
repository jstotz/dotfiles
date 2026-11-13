// Picks the space to nest a space under: every open space but itself and the spaces
// already beneath it. Type to filter, ↑/↓ to move, Enter to nest, Esc to cancel.
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, spaces } from "herdr";
import { spaceGroups, within } from "../git/groups.js";
import { TEXT } from "./ui.js";

export class SpacePicker {
  init(_props, cx) {
    this.at = 0;
    this.error = "";
    this.text = "";
    this.input = InputState.new({ placeholder: "parent space" });
    this.input.on("change", (_e, cx) => {
      this.text = this.input.value();
      this.at = 0;
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.pick(this.shown()[this.at], cx));
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
    spaceGroups.start(cx);
  }

  shown() {
    const self = props()?.space;
    const f = this.text.trim().toLowerCase();
    return spaces().filter(
      (s) =>
        s.id !== self &&
        !within(spaceGroups.parents, s.id, self) &&
        (!f || s.name.toLowerCase().includes(f)),
    );
  }

  pick(space, cx) {
    if (!space) return;
    const p = props();
    spaceGroups
      .nest(p.space, space.id)
      .then(() => closeOverlay(p.overlay))
      .catch((e) => {
        this.error = String(e.message ?? e);
        cx.notify();
      });
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const rows = this.shown();
    const self = spaces().find((s) => s.id === p.space);
    return v_flex()
      .id("space-picker")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        const n = rows.length;
        if (e.key === "escape") closeOverlay(p.overlay);
        else if ((e.key === "down" || e.key === "up") && n)
          this.at = (this.at + (e.key === "down" ? 1 : n - 1)) % n;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .size_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(TEXT.body)
      .child(div().font_semibold().text_color(t.foreground).child(`Set parent of ${self?.name ?? "space"}`))
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
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).child(this.error)))
      .child(
        v_flex()
          .id("space-picker-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .children(
            rows.map((s, i) =>
              h_flex()
                .id(`pick-${s.id}`)
                .flex_none()
                .h(30)
                .px(10)
                .rounded(7)
                .items_center()
                .cursor_pointer()
                .text_color(t.foreground)
                .when(i === this.at, (el) => el.bg(t.selected))
                .when(i !== this.at, (el) => el.hover((st) => st.bg(t.hover)))
                .on_click((_e, cx) => this.pick(s, cx))
                .child(div().flex_1().truncate().child(s.name)),
            ),
          )
          .when(!rows.length, (el) => el.child(div().p(10).text_color(t.dim).child("No matching spaces."))),
      );
  }
}
