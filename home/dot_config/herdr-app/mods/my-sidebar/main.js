// My Sidebar, from munza/herdr-mods' Better Sidebar 3.3.0: spaces, agents, both in one
// block (lists), a footer, a right panel toggle, the space and group menus with
// their name prompt, the parent picker, the archive confirmation, and the Worktrunk new-worktree dialog. A layout or overlay puts one copy per block, and `view` picks the part.
import { View } from "gpui-kit";
import { props } from "herdr";
import { Spaces } from "./views/spaces.js";
import { Agents } from "./views/agents.js";
import { Lists } from "./views/lists.js";
import { Footer } from "./views/footer.js";
import { PanelToggle } from "./views/panel-toggle.js";
import { SpaceMenu } from "./views/space-menu.js";
import { GroupPrompt } from "./views/group-prompt.js";
import { SpacePicker } from "./views/space-picker.js";
import { ArchiveConfirm } from "./views/archive-confirm.js";
import { WorktreeNew } from "./views/worktree-new.js";

const PARTS = {
  lists: Lists,
  agents: Agents,
  footer: Footer,
  "panel-toggle": PanelToggle,
  "space-menu": SpaceMenu,
  "group-menu": SpaceMenu,
  "group-prompt": GroupPrompt,
  "space-picker": SpacePicker,
  "archive-confirm": ArchiveConfirm,
  "worktree-new": WorktreeNew,
};

export default class BetterSidebar extends View {
  init(given, cx) {
    const Part = PARTS[props()?.view] ?? Spaces;
    this.part = new Part();
    this.part.init(given, cx);
  }

  render(cx) {
    return this.part.render(cx);
  }
}
