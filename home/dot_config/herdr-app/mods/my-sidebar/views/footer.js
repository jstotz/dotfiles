// The sidebar's last line: Settings, Mod settings and Add machine as icons. Herdr's
// own footer gives each a labelled row, which costs twice the height. Mod settings
// opens Better Config, and shows only when that mod is installed.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, updates, readTextFile, appHome } from "herdr";
import { Icon, SIZE } from "./ui.js";

export class Footer {
  init(_given, cx) {
    this.hasConfig = false;
    // shortcut: checked once, so installing Better Config shows the button after the next reload.
    readTextFile(`${appHome()}/mods/better-config/mod.json`)
      .then((raw) => {
        this.hasConfig = raw !== null;
        cx?.notify();
      })
      .catch(() => {});
  }

  button(id, label, action, t, icons) {
    return h_flex()
      .id(id)
      .h(SIZE.icon)
      .px(6)
      .gap(3)
      .flex_none()
      .items_center()
      .rounded(6)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .accessibility_label(label)
      .tooltip(label)
      .on_click(action)
      .children(icons);
  }

  render() {
    const t = theme();
    const updateDot = updates().app.ready ? [div().size(6).rounded_full().bg(t.accent)] : [];
    return h_flex()
      .id("sidebar-footer")
      .size_full()
      .px(8)
      .gap(2)
      .items_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .child(
        this.button("settings", "Settings", () => run("app.settings"), t, [
          Icon("settings"),
          ...updateDot,
        ]),
      )
      .when(this.hasConfig, (el) =>
        el.child(
          this.button("mod-settings", "Mod settings", () => run("mod.open", { name: "better-config" }), t, [
            Icon("sliders"),
          ]),
        ),
      )
      .child(
        this.button("machine", "Add machine", () => run("mod.open", { name: "machine-add" }), t, [
          Icon("plus", 12),
          Icon("server"),
        ]),
      );
  }
}
