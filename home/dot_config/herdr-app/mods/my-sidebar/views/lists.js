// Spaces and agents in one block. Combined (the default): tabs for Spaces, with
// each space's tabs and agents under it, and Agents. With `combined: false` in the settings: the
// two lists one above the other, as two blocks of this mod would draw them.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, focused, spaces, theme, setAgentOrder } from "herdr";
import { Spaces, carry } from "./spaces.js";
import { isArchiving } from "../git/archive.js";
import { Agents } from "./agents.js";
import { TEXT, Badge, Rail, Icon } from "./ui.js";

const TABS = ["spaces", "agents"];
// A folded space speaks for its agents: the most urgent one's state.
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

export class Lists {
  init(props, cx) {
    this.spaces = new Spaces();
    this.spaces.init(props, cx);
    this.agents = new Agents();
    this.agents.init(props, cx);
    const saved = localStorage.getItem("lists.tab");
    this.tab = TABS.includes(saved) ? saved : "spaces";
    // Space ID -> folded, for spaces the person folded or opened. Others follow the
    // default: folded when a single agent is all that sits beneath them.
    try {
      this.folds = JSON.parse(localStorage.getItem("lists.folds") ?? "{}");
    } catch {
      this.folds = {};
    }
  }

  // Rolled up: its tabs, agents and the spaces beneath it hidden. By default only a
  // space whose single agent is all it holds.
  isFolded(w, items, kids) {
    return this.folds[w.id] ?? (!kids && items.length === 1 && Boolean(items[0].a));
  }

  toggleFold(w, folded, cx) {
    this.folds[w.id] = !folded;
    // Forget spaces that closed, so the saved choices don't grow forever.
    const open = new Set(spaces().map((s) => s.id));
    for (const id of Object.keys(this.folds)) if (!open.has(id)) delete this.folds[id];
    localStorage.setItem("lists.folds", JSON.stringify(this.folds));
    cx.notify();
  }

  // The fold chevron. The row selects its space on mouse-up, so stop both presses.
  foldButton(w, folded, t) {
    return div()
      .id(`space-fold-${w.id}`)
      .flex_none()
      .w(15)
      .p(2)
      .rounded(4)
      .text_color(t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(folded ? "Expand" : "Roll up")
      .on_mouse_down("left", (_e, cx) => {
        cx.stop_propagation();
        this.spaces.pressed = null;
        this.spaces.over = null;
      })
      .on_mouse_up("left", (_e, cx) => {
        cx.stop_propagation();
        this.toggleFold(w, folded, cx);
      })
      .child(Icon(`chevron-${folded ? "right" : "down"}`, 11));
  }

  pick(tab, cx) {
    this.tab = tab;
    localStorage.setItem("lists.tab", tab);
    cx.notify();
  }

  render() {
    const t = theme();
    const collapsed = this.spaces.collapsed();
    const root = v_flex()
      .id("better-sidebar-lists")
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(TEXT.body)
      .on_size_change((size, cx) => this.spaces.resized(size, cx));
    this.spaces.under = null;
    this.spaces.quiet = null;
    this.spaces.above = null;
    this.spaces.trailing = null;
    this.spaces.leading = null;
    this.spaces.rolledUp = null;
    this.spaces.statusIcon = (status) => this.agents.status(t, { status }, true);
    // The rail has no room for tabs: both lists, as numbers.
    if (!this.spaces.settings.combined || collapsed)
      return root
        .child(
          v_flex()
            .flex_1()
            .min_h(0)
            .child(this.spaces.header(t, collapsed))
            .child(this.spaces.body(t, collapsed)),
        )
        .child(v_flex().flex_1().min_h(0).child(this.agents.render()));

    const view = this.agents.readView();
    root.child(this.tabBar(t, view));
    if (this.tab !== "spaces") return root.child(this.agents.render({ view, heading: false }));

    // Spaces, each with its tabs and agents beneath in tab order, so rows don't move as
    // their state changes; next-agent keys follow that order.
    const nested = { ...view, sort: { id: "grouped" }, byPriority: false, nested: true };
    const order = [];
    const all = agents();
    // Pinned agents go above every space, in the Agents tab's Pinned group.
    const pinned = view.groups.find((g) => g.id === "pinned");
    const pins = pinned?.members.map((a) => a.address) ?? [];
    order.push(...pins);
    this.spaces.above = () => (pinned ? this.agents.groupRows(pinned, 0, view, t) : []);
    const nest = (lines, row) =>
      h_flex().w_full().min_w(0).children(lines.map((l) => Rail(l))).child(row.flex_1().min_w(0));
    // A space's agents hang from its line; a main space's worktrees come after them,
    // so its line carries on, and a worktree's own agents sit one step further in.
    // Every tab shows: a tab with agents as its agents, any other as itself.
    const shownTab = focused()?.tab;
    const plain = (tab) => !all.some((a) => a.tab === tab.id);
    const itemsOf = (w) =>
      w.tabs.flatMap((tab) =>
        plain(tab)
          ? tab.settled ? [] : [{ tab }]
          : all.filter((a) => a.tab === tab.id && !pins.includes(a.address)).map((a) => ({ a })),
      );
    // A space with anything beneath it folds; folded, it shows its agents' state.
    const folded = (w) => this.isFolded(w, itemsOf(w), this.spaces.kidCount(w));
    this.spaces.rolledUp = folded;
    this.spaces.trailing = (w) => {
      const items = itemsOf(w);
      const kids = this.spaces.kidCount(w);
      if (!items.length && !kids) return [];
      const rolled = this.isFolded(w, items, kids);
      // Rolled up, a space speaks for everything beneath it.
      const ids = rolled ? this.spaces.descendants(w.id).add(w.id) : new Set([w.id]);
      const mine = all.filter((a) => ids.has(a.space));
      const top = mine.reduce((most, a) => ((RANK[a.status] ?? 0) > (RANK[most] ?? 0) ? a.status : most), null);
      return rolled && top ? [this.agents.status(t, { status: top }, true)] : [];
    };
    // Chevrons at the left, statuses at the right. A space with nothing to fold keeps
    // the chevron's room so names line up; the -4 margin tightens the row's 9px gap.
    this.spaces.leading = (w) => {
      const items = itemsOf(w);
      const kids = this.spaces.kidCount(w);
      if (!items.length && !kids) return [div().w(15).mr(-4).flex_none()];
      return [this.foldButton(w, this.isFolded(w, items, kids), t).mr(-4)];
    };
    this.spaces.under = ({ w, rails, kids }) => {
      const items = itemsOf(w);
      // Hidden agents keep their place for next-agent keys.
      order.push(...items.filter((x) => x.a).map((x) => x.a.address));
      if (folded(w)) return [];
      const before = carry(rails);
      // An archiving space's agents and tabs go dim with it.
      const fade = isArchiving(w.id) ? (el) => el.opacity(0.4) : (el) => el;
      return items.flatMap((x, i) => {
        const last = i === items.length - 1 && !kids;
        const [row, ...subs] = (
          x.a
            ? this.agents.agentWithSubs(x.a, i, nested, t)
            : [this.agents.tabRow(w, x.tab, x.tab.id === shownTab, t)]
        ).map(fade);
        return [nest([...before, last ? "└" : "├"], row), ...subs.map((s) => nest([...before, last ? "" : "│"], s))];
      });
    };
    // One row lit: a space whose focused agent or tab shows beneath it leaves it to that row.
    // A folded space keeps the fill: what's focused beneath it isn't drawn.
    this.spaces.quiet = (w) =>
      !folded(w) &&
      (all.some((a) => a.space === w.id && a.focused) || w.tabs.some((tab) => tab.id === shownTab && plain(tab)));
    const body = this.spaces.body(t, false);
    setAgentOrder(order);
    return root.child(body);
  }

  // Tabs side by side from the left, the picked one filled.
  tabBar(t, view) {
    const tab = (id, label, count) =>
      h_flex()
        .id(`lists-tab-${id}`)
        .px(10)
        .h(24)
        .gap(5)
        .justify_center()
        .items_center()
        .rounded(6)
        .cursor_pointer()
        .text_size(TEXT.label)
        .font_medium()
        .text_color(this.tab === id ? t.foreground : t.dim)
        .when(this.tab === id, (el) => el.bg(t.selected))
        .when(this.tab !== id, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .on_click((_e, cx) => this.pick(id, cx))
        .child(label)
        // The count badge the group headers use.
        .when(count !== null, (el) => el.child(Badge(count)));
    return h_flex()
      .px(8)
      .pt(6)
      .pb(6)
      .mb(4)
      .border_b(1)
      .border_color(t.border)
      .flex_none()
      .gap(6)
      .items_center()
      .child(
        h_flex()
          .flex_1()
          .gap(2)
          .child(tab("spaces", "Spaces", null))
          .child(tab("agents", "Agents", view.count)),
      )
      .child(this.tab === "spaces" ? this.spaces.newSpaceButton() : this.agents.sortMenu());
  }
}
