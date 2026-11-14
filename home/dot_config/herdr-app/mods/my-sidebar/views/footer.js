// The sidebar's last line: Settings, Mod settings and Add machine as icons. Herdr's
// own footer gives each a labelled row, which costs twice the height. Mod settings
// opens Better Config, and shows only when that mod is installed. At the right,
// Micro (the micro mod's agent, which lives outside every space) and its status;
// a click summons it.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, updates, readTextFile, appHome, terminals } from "herdr";
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

  // Micro's state: its terminal's status word, or "off" when it isn't running.
  micro(t) {
    const term = terminals().find((x) => x.name === "micro" && x.state === "live");
    const status = term ? (term.status ?? "idle") : "off";
    const mark =
      status === "working"
        ? Icon("spinner", 12).text_color(t.working).spin(900)
        : div()
            .size(8)
            .rounded_full()
            .flex_none()
            .when(status === "blocked" || status === "done", (el) => el.bg(status === "blocked" ? t.blocked : t.done))
            .when(status === "idle" || status === "off", (el) => el.border_1().border_color(status === "off" ? t.dim : t.muted));
    const words = { working: "working", blocked: "needs you", done: "done", idle: "idle", off: "not running" };
    return h_flex()
      .id("micro")
      .h(SIZE.icon)
      .px(8)
      .gap(6)
      .flex_none()
      .items_center()
      .rounded(6)
      .text_size(12)
      .text_color(status === "blocked" ? t.foreground : t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(`Micro: ${words[status] ?? status} (cmd-k)`)
      .on_click(() => run("micro.show"))
      .child("Micro")
      .child(mark);
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
      )
      .child(div().flex_1())
      .child(this.micro(t));
  }
}
