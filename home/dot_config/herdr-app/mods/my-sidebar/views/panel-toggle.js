// The button that hides and shows the right panel, in its own small block beside
// the tab bar, and the key command that does the same.
import { h_flex } from "gpui-base";
import { theme, run, props, layout, nextCommand } from "herdr";
import { findNode } from "./find-node.js";
import { IconButton } from "./ui.js";

export class PanelToggle {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) if ((await nextCommand()) === "toggle-panel") this.toggle();
    });
  }

  panel() {
    return findNode(layout(), props()?.target ?? "panel");
  }

  // Hide the container, not its active child, so reopening keeps the selection.
  toggle() {
    const panel = this.panel();
    if (panel) run("layout.toggle", { id: panel.id });
  }

  render() {
    const t = theme();
    const panel = this.panel();
    const bar = h_flex()
      .id("panel-toggle-bar")
      .size_full()
      .pr(10)
      .items_center()
      .justify_end()
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border);
    if (!panel) return bar;
    return bar.child(
      IconButton({
        id: "panel-toggle",
        icon: "panel-right",
        label: panel.hidden ? "Show sidebar" : "Hide sidebar",
        iconSize: 16,
        muted: panel.hidden,
        onClick: () => this.toggle(),
      }),
    );
  }
}
