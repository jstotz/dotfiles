// Micro, the always-ready coordinator agent, summoned over any space. One
// long-lived herdr-core terminal named `micro` runs Claude in Micro's config
// folder. `micro.toggle` (cmd-k) shows it in Herdr's peek over the current tab,
// with the keyboard, or hides it when it already has the keyboard;
// `micro.show` only shows it (for the palette). Either starts Micro,
// continuing its last conversation, when it isn't running, and records the
// space you came from for Micro to read as "here".
//
// The layout holds one empty floating copy of this mod to receive those
// commands (a hidden block's mod never runs).
import { View, div } from "gpui-kit";
import { nextCommand } from "herdr";
import { toggle, show, hide } from "./micro.js";

export default class Micro extends View {
  init(_given, cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        const act = { toggle, show, hide }[await nextCommand()];
        if (act) await Promise.resolve(act(cx)).catch((e) => console.warn(`micro: ${e.message ?? e}`));
        cx.notify();
      }
    });
  }

  render() {
    return div();
  }
}
