// The spaces list: right-aligned branches, nested worktrees and a PR status line.
// Repository facts follow each space's first terminal.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import {
  agents,
  spaces,
  machines,
  panes,
  run,
  openOverlay,
  hc,
  theme,
  shared,
  setShared,
  watchFolder,
  window,
  layout,
} from "herdr";
import { PRStatusObserver, prPlaceKey, prAppearance } from "../git/pr-status.js";
import { spaceFolder, checkoutKey, readCheckout } from "../git/checkouts.js";
import { loadSettings, duration } from "../settings.js";
import { findNode } from "./find-node.js";
import { TEXT, Icon, IconButton, Badge, Rail } from "./ui.js";
import { spaceGroups, DEFAULT_GROUP, within } from "../git/groups.js";

const USUAL_BRANCHES = new Set(["main", "master"]);
const rowHeight = ({ rails }) => (rails.length ? 24 : 26);
// A row's rails carried on beneath it: a branch becomes a line, an end becomes blank.
export const carry = (rails) => rails.map((k) => (k === "├" ? "│" : k === "└" ? "" : k));
const connector = (i, n) => (i === n - 1 ? "└" : "├");

// Watches and terminal events handle most changes. Poll visible repositories
// occasionally to catch edits and commits made outside Herdr.
const GIT_FALLBACK_MS = 15000;
// Preferences a person may change in the installed mod.json under `settings`.
// `combined` is read by the lists view: tabs, or spaces above agents.
const DEFAULT_SETTINGS = { git: { retry_after: "15s" }, pull_request_status: true, combined: true };

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const AVATAR_COLORS = {
  ansi6: "#22a99a",
  ansi3: "#e3814f",
  ansi4: "#5b8def",
  ansi5: "#8b7cf6",
  ansi2: "#3fae6a",
  ansi1: "#d9649a",
};

// A space speaks up only when something in it needs you.
function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

function tone(t, status) {
  return t[status] ?? t.unknown;
}

export class Spaces {
  // ── Lifecycle and refresh scheduling ──────────────────────────────────────

  init(_props, cx) {
    this.prObserver = new PRStatusObserver();
    this.settings = DEFAULT_SETTINGS;
    this.applySettings(cx);
    // Repository caches are keyed by [machine, folder], so equal paths on
    // different machines cannot share Git or PR state. null means not a repo.
    this.git = Object.create(null);
    this.checked = {}; // Checkout key -> last Git read time.
    this.unsure = new Set(); // Transient failures, eligible for retry.
    this.pending = new Set(); // Deduplicated queue for the single Git reader.

    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // Space ID -> checkout key at the previous refresh.
    this.watching = new Set(); // local repos' git folders
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    this.machines = [];
    this.folded = new Set();
    try {
      this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]"));
    } catch {
      /* Ignore invalid saved UI state. */
    }
    try {
      this.groupFolds = JSON.parse(localStorage.getItem("groups.folds") ?? "{}");
    } catch {
      this.groupFolds = {};
    }
    spaceGroups.start(cx);
    this.refreshMachines(cx);
    cx.timer.every(15000, (cx) => this.refreshMachines(cx));
    // `git status` walks the whole tree, on another machine a process there:
    // only when its answer could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  // Read the installed mod.json once; Herdr restarts the mod when it changes.
  applySettings(cx) {
    cx.spawn(async (cx) => {
      const { settings, problems } = await loadSettings("my-sidebar", DEFAULT_SETTINGS);
      this.settings = settings;
      for (const problem of problems) console.warn(`my-sidebar mod.json settings: ${problem}`);
      cx.notify();
    });
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    this.updateColors(sp);
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const ps = panes();
    this.publishParents(sp, ps);
    const places = sp.map((s) => {
      const tabs = new Set((s.tabs ?? []).map((tab) => tab.id));
      const folder = spaceFolder(s, ps);
      return {
        folder,
        machine: s.machine,
        branch:
          ps.find((p) => tabs.has(p.tab) && p.cwd === folder)?.branch ??
          this.git[prPlaceKey(s.machine, folder)]?.branch,
      };
    });
    if (this.settings.pull_request_status) this.prObserver.refresh(places, cx);
    const due = this.due(now, sp, ps);
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id))) cx.notify();
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, spaceList, paneList) {
    const places = Object.create(null);
    for (const space of spaceList) places[space.id] = checkoutKey(space, paneList);
    const used = new Set(Object.values(places).filter((key) => JSON.parse(key)[1]));
    const due = new Set([...used].filter((key) => !(key in this.git)));

    this.addChangedBranches(due, now, spaceList, paneList, places);
    this.addRevisited(due, places, used);
    this.addFinishedWork(due, spaceList, paneList, places, used);
    this.addReconnected(due, used);
    this.addFallbacks(due, now, used);
    return due;
  }

  // Branch names arrive live from Herdr. Refresh richer Git metadata promptly
  // after a checkout, without waiting for the slower fallback poll.
  addChangedBranches(due, now, spaceList, paneList, places) {
    for (const space of spaceList) {
      const key = places[space.id];
      const folder = spaceFolder(space, paneList);
      const tabIDs = new Set((space.tabs ?? []).map((tab) => tab.id));
      const branch = paneList.find((pane) => tabIDs.has(pane.tab) && pane.cwd === folder)?.branch;
      const stale = branch && !this.unsure.has(key) && this.git[key]?.branch !== branch;
      if (stale && now - (this.checked[key] ?? 0) > 1000) due.add(key);
    }
  }

  // Returning to a previously visited folder still requires a fresh read.
  addRevisited(due, places, used) {
    for (const [id, key] of Object.entries(places)) {
      if (this.at[id] && this.at[id] !== key && used.has(key)) due.add(key);
    }
    this.at = places;
  }

  // A completed command may have changed sibling worktrees' ahead/behind too.
  addFinishedWork(due, spaceList, paneList, places, used) {
    const spaceByTab = {};
    for (const space of spaceList) {
      for (const tab of space.tabs ?? []) spaceByTab[tab.id] = space;
    }
    const busy = {};
    for (const pane of paneList) {
      if (!pane.terminal || !spaceByTab[pane.tab]) continue;
      busy[pane.pane] = pane.status === "working" || !(pane.program?.shell || pane.program?.agent);
      if (this.busy[pane.pane] && !busy[pane.pane]) {
        const key = places[spaceByTab[pane.tab].id];
        this.sameRepo(key, used).forEach((k) => due.add(k));
      }
    }
    this.busy = busy;
  }

  addReconnected(due, used) {
    for (const machine of machines()) {
      const ready = machine.layout === "ready";
      if (ready && this.ready[machine.name] === false) {
        for (const key of used) if (JSON.parse(key)[0] === machine.name) due.add(key);
      }
      this.ready[machine.name] = ready;
    }
  }

  addFallbacks(due, now, used) {
    if (!window().active) return;
    const every = duration(this.settings.git.retry_after, GIT_FALLBACK_MS);
    for (const key of used) {
      const watched = this.git[key] || this.unsure.has(key);
      const shown = !this.folded.has(JSON.parse(key)[0]);
      if (watched && shown && now - (this.checked[key] ?? 0) > every) due.add(key);
    }
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["machine", "ls", "--json"]);
        if (r.code === 0)
          this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary);
      } catch {
        // Keep the last machine list if core is temporarily unavailable.
      }
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        for (const key of keys) await this.check(key, cx);
      }
      const used = new Set(
        Object.values(this.git)
          .filter(Boolean)
          .map((g) => JSON.parse(g.repo))
          .filter(([on]) => !on)
          .map(([, repo]) => repo),
      );
      for (const repo of this.watching) if (!used.has(repo)) this.watching.delete(repo);
      this.refreshing = false;
      cx.notify();
    });
  }

  // ── Read-only Git metadata and local watches ──────────────────────────────

  // One place's git. A failure to ask (the machine is away) keeps what it showed.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      const info = await readCheckout(cwd, on);
      this.git[key] = info;
      if (info && !on) this.watch(JSON.parse(info.repo)[1], cx);
    } catch {
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    this.watching.add(repo);
    cx.spawn(async (cx) => {
      try {
        while (this.watching.has(repo)) {
          await watchFolder(repo);
          const mine = JSON.stringify([null, repo]);
          if (this.watching.has(repo))
            this.refreshGit(
              Object.keys(this.git).filter((k) => this.git[k]?.repo === mine),
              cx,
            );
        }
      } catch {
        this.watching.delete(repo);
      }
    });
  }

  // ── Space navigation and worktree/machine grouping ────────────────────────

  // Tells the agents block, a separate copy, which main space each space belongs
  // to: the repository's open main checkout, else the repository's folder name.
  publishParents(sp, ps) {
    const known = sp.map((w) => ({ w, g: this.git[checkoutKey(w, ps)] })).filter((r) => r.g);
    const parents = {};
    for (const { w, g } of known) {
      const main = known.find((r) => r.g.repo === g.repo && !r.g.linked);
      const folder = JSON.parse(g.repo)[1]
        .replace(/\/\.git\/?$/, "")
        .split("/")
        .pop();
      parents[w.id] = { key: g.repo, label: main?.w.name || folder };
    }
    const text = JSON.stringify(parents);
    if (text === this.parentsText) return;
    this.parentsText = text;
    setShared("my-sidebar.space-parents", parents);
  }

  // This mod's own space menu: Herdr's items plus groups and pins.
  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({
      mod: "my-sidebar",
      kind: "popup",
      width: 220,
      height: 520,
      props: { view: "space-menu", space: w.id },
    });
  }

  groupMenu(group) {
    openOverlay({
      mod: "my-sidebar",
      kind: "popup",
      width: 200,
      height: 200,
      props: { view: "group-menu", group: group.name },
    });
  }

  toggleGroup(id, cx) {
    this.groupFolds[id] = !this.groupFolds[id];
    localStorage.setItem("groups.folds", JSON.stringify(this.groupFolds));
    cx.notify();
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces();
    const ps = panes();
    const ready = (w) =>
      this.shown.has(w.id) ||
      checkoutKey(w, ps) in this.git ||
      Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const all = sp
      .map((w, i) => ({ w, i, g: this.git[checkoutKey(w, ps)] ?? null }))
      .filter((r) => this.shown.has(r.w.id));
    // A space nested under an open space hangs beneath it, wherever the parent is.
    // A loop someone wrote into the file by hand nests nothing.
    const open = new Set(all.map((r) => r.w.id));
    const parentOf = (id) => {
      const parent = spaceGroups.parentOf(id);
      return parent && open.has(parent) && !within(spaceGroups.parents, parent, id) ? parent : null;
    };
    const children = new Map();
    for (const r of all) {
      const parent = parentOf(r.w.id);
      if (parent) children.set(parent, [...(children.get(parent) ?? []), r]);
    }
    const mains = new Set(all.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const worktreesOf = new Map();
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of all) {
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      worktreesOf.set(r.w.id, all.filter((k) => nested(k) && k.g.repo === r.g.repo && !parentOf(k.w.id)));
    }
    this.children = children;
    this.worktreesOf = worktreesOf;
    const top = all
      .filter((r) => !parentOf(r.w.id) && !nested(r))
      .map((r) => ({ ...r, worktrees: worktreesOf.get(r.w.id) ?? [] }));
    // Repository -> group -> space: a main checkout's worktrees, and the top level,
    // gather into groups once any of them is in a named group. Beneath a space come its
    // child spaces, then its worktrees, unless it is rolled up.
    const out = [];
    this.kidCounts = new Map();
    const emit = (r, rails, worktree) => {
      const kids = children.get(r.w.id) ?? [];
      const worktrees = r.worktrees ?? [];
      const count = kids.length + worktrees.length;
      this.kidCounts.set(r.w.id, count);
      out.push({ ...r, rails, worktree, kids: count });
      if (!count || this.rolledUp?.(r.w)) return;
      const base = carry(rails);
      kids.forEach((k, n) =>
        emit(
          { ...k, worktrees: worktreesOf.get(k.w.id) ?? [] },
          [...base, n === kids.length - 1 && !worktrees.length ? "└" : "├"],
          Boolean(k.g?.linked),
        ),
      );
      if (worktrees.length) this.gather(worktrees, base, true, `repo:${r.g.repo}`, out, emit);
    };
    this.gather(top, [], false, "top", out, emit);
    return out;
  }

  // How many spaces hang beneath a space (children and worktrees), as last drawn.
  kidCount(w) {
    return this.kidCounts?.get(w.id) ?? 0;
  }

  // Every space beneath one, at any depth.
  descendants(id, out = new Set()) {
    for (const r of [...(this.children?.get(id) ?? []), ...(this.worktreesOf?.get(id) ?? [])]) {
      if (out.has(r.w.id)) continue;
      out.add(r.w.id);
      this.descendants(r.w.id, out);
    }
    return out;
  }

  // Lays out `members` under `base` rails. Without named groups they list as they are;
  // with them, "default" (the ungrouped) comes first, then named groups in their
  // order, each listing its pinned spaces first. `line` draws connectors to them.
  gather(members, base, line, key, out, emit) {
    const worktree = line;
    const named = new Map();
    const loose = [];
    for (const r of members) {
      const group = spaceGroups.groupOf(r.w.id);
      if (group) named.set(group.name, [...(named.get(group.name) ?? []), r]);
      else loose.push(r);
    }
    if (!named.size) {
      members.forEach((r, i) => emit(r, line ? [...base, connector(i, members.length)] : base, worktree));
      return;
    }
    const groups = [
      ...(loose.length ? [{ name: DEFAULT_GROUP, rows: loose, pinned: [] }] : []),
      ...spaceGroups.groups
        .filter((g) => named.has(g.name))
        .map((g) => ({ name: g.name, rows: named.get(g.name), pinned: g.pinned })),
    ];
    groups.forEach((group, n) => {
      const rails = line ? [...base, connector(n, groups.length)] : base;
      const id = `${key}:${group.name}`;
      const folded = Boolean(this.groupFolds[id]);
      const place = (r) => {
        const at = group.pinned.indexOf(r.w.id);
        return at < 0 ? Infinity : at;
      };
      const rows = [...group.rows].sort((a, b) => place(a) - place(b) || a.i - b.i);
      out.push({ group: { id, name: group.name, rows, folded }, rails, machine: rows[0].w.machine ?? null });
      if (!folded) rows.forEach((r, i) => emit(r, [...carry(rails), connector(i, rows.length)], worktree));
    });
  }

  // A group's heading: fold chevron, name, count, and folded, its spaces' state.
  groupRow(r, t) {
    const { group, rails } = r;
    const ids = new Set(group.rows.map((x) => x.w.id));
    const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
    const top = group.folded
      ? agents()
          .filter((a) => ids.has(a.space))
          .reduce((most, a) => ((RANK[a.status] ?? 0) > (RANK[most] ?? 0) ? a.status : most), null)
      : null;
    const head = h_flex()
      .id(`group-${group.id}`)
      .h(22)
      .px(8)
      .gap(6)
      .flex_none()
      .items_center()
      .rounded(7)
      .text_size(TEXT.caption)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => this.toggleGroup(group.id, cx))
      .when(group.name !== DEFAULT_GROUP, (el) => el.on_mouse_down("right", () => this.groupMenu(group)))
      .child(Icon(group.folded ? "chevron-right" : "chevron-down", 11).text_color(t.dim))
      .child(div().min_w(0).truncate().font_medium().child(group.name))
      .child(Badge(group.rows.length))
      .child(div().flex_1())
      .when(Boolean(top), (el) => el.child(this.statusIcon?.(top) ?? div().text_color(tone(t, top)).child(glyph(top))));
    if (!rails.length) return head;
    if (!this.under) return head.pl(8 + 22 * rails.length);
    return h_flex().w_full().min_w(0).children(rails.map((k) => Rail(k, 11))).child(head.flex_1().min_w(0));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    // `under`, set by the lists view, adds rows beneath a space: its agents.
    const draw = (r) =>
      r.group
        ? collapsed ? [] : [this.groupRow(r, t)]
        : collapsed ? [this.compact(r, t)] : [this.row(r, t), ...(this.under?.(r) ?? [])];
    const remote = [
      ...new Set([
        ...rows.map((r) => (r.group ? r.machine : r.w.machine)).filter(Boolean),
        ...this.machines.map((m) => m.name),
      ]),
    ].sort();
    if (!remote.length) {
      return this.machineLoading(null) && !rows.length
        ? [this.loadingRow(null, t, collapsed)]
        : rows.flatMap(draw);
    }
    return [null, ...remote].flatMap((m) => {
      const head = this.machineHeader(m, t, collapsed);
      if (this.folded.has(m)) return [head];
      const mine = rows.filter((r) => ((r.group ? r.machine : r.w.machine) ?? null) === m);
      if (mine.length) return [head, ...mine.flatMap(draw)];
      const placeholder = this.machineLoading(m)
        ? this.loadingRow(m, t, collapsed)
        : this.newSpaceRow(m, t, collapsed);
      return [head, placeholder];
    });
  }

  machineLoading(m) {
    const layout = machines().find((k) => k.name === m)?.layout;
    return (
      layout === "loading" ||
      (!layout && this.machines.some((k) => k.name === m && k.state === "connected")) ||
      spaces().some((s) => (s.machine ?? null) === m && !this.shown.has(s.id))
    );
  }

  loadingRow(m, t, collapsed) {
    return div()
      .id(`machine-loading-${m ?? "local"}`)
      .h(28)
      .flex_none()
      .px(8)
      .text_size(TEXT.small)
      .text_color(t.dim)
      .child(collapsed ? "…" : "Loading…");
  }

  newSpaceRow(m, t, collapsed) {
    return h_flex()
      .id(`machine-new-${m ?? "local"}`)
      .h(28)
      .flex_none()
      .px(8)
      .gap(7)
      .items_center()
      .rounded(7)
      .text_size(TEXT.small)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("space.new", m ? { machine: m } : {}))
      .child(Icon("plus", 12))
      .when(!collapsed, (el) => el.child("New space there"));
  }

  machineHeader(m, t, collapsed) {
    const machine = this.machines.find((k) => k.name === m);
    const connected = !m || machine?.state === "connected";
    const head = h_flex()
      .id(`machine-${m ?? "local"}`)
      .h(26)
      .flex_none()
      .px(collapsed ? 2 : 8)
      .gap(7)
      .items_center()
      .text_size(TEXT.caption)
      .text_color(t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => {
        if (!this.folded.delete(m)) this.folded.add(m);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        cx.notify();
      })
      .child(Icon(m ? "server" : "monitor", 13));
    if (collapsed) return head;
    return head
      .child(
        div()
          .flex_1()
          .truncate()
          .child(m ?? "This computer"),
      )
      .when(!connected, (el) =>
        el.child(
          div()
            .flex_none()
            .child((machine?.state ?? "asleep").replace(/_/g, " ")),
        ),
      )
      .when(connected, (el) => el.child(this.machineAddButton(m, t)))
      .child(
        div()
          .size(6)
          .rounded(3)
          .flex_none()
          .bg(connected ? t.ansi2 : t.dim),
      )
      .child(Icon(`chevron-${this.folded.has(m) ? "right" : "down"}`, 11));
  }

  machineAddButton(m, t) {
    return div()
      .id(`machine-add-${m ?? "local"}`)
      .flex_none()
      .px(4)
      .rounded(4)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run("space.new", m ? { machine: m } : {});
      })
      .child("+");
  }

  // ── Branch and PR descriptions ───────────────────────────────────────────

  // The right end of a name row: the branch unless it's the usual one or repeats the
  // name, and on the selected space how far it is from its remote.
  // The branch, quietly beside the name. main, master and the space's own name go without saying.
  branchName(g, name, t) {
    const branch = g?.branch === "(detached)" ? "detached" : (g?.branch ?? "detached");
    const shown = g && !USUAL_BRANCHES.has(branch) && branch !== name;
    return div()
      .flex_1()
      .min_w(0)
      .truncate()
      .text_size(TEXT.caption)
      .text_color(t.dim)
      .when(shown, (el) => el.tooltip(branch).child(branch));
  }

  // At the right: the checkout's pull request, and ahead/behind on the selected space.
  // `trailing`, set by the lists view, adds a folded space's status.
  gitTail(g, active, t, w) {
    const pr = w ? this.prBadge(w, t) : null;
    const trailing = w ? (this.trailing?.(w) ?? []) : [];
    return h_flex()
      .flex_none()
      .gap(5)
      .items_center()
      .text_size(TEXT.label)
      .text_color(t.dim)
      .when(Boolean(pr), (el) => el.child(pr))
      .when(active && g?.ahead > 0, (el) => el.child(Badge(`\u2191${g.ahead}`)))
      .when(active && g?.behind > 0, (el) => el.child(Badge(`\u2193${g.behind}`)))
      .children(trailing);
  }

  // The branch and PR must describe the same checkout: the space's first
  // terminal, matching Herdr's space naming and worktree grouping semantics.
  checkoutStatus(w) {
    const ps = panes();
    const folder = spaceFolder(w, ps);
    const tabs = new Set((w.tabs ?? []).map((tab) => tab.id));
    const branch =
      ps.find((pane) => tabs.has(pane.tab) && pane.cwd === folder)?.branch ??
      this.git[prPlaceKey(w.machine, folder)]?.branch;
    const status = this.prObserver.entries.get(prPlaceKey(w.machine, folder));
    return status?.branch === branch ? status : null;
  }

  checkoutPRs(w) {
    return this.checkoutStatus(w)?.prs ?? [];
  }

  // Keep ordinary clicks available to the enclosing space row. Modified link
  // presses must stop both mouse events: the row selects on mouse-up, not click.
  isPRLinkClick(event) {
    return window().platform === "macos"
      ? Boolean(event.modifiers?.platform)
      : Boolean(event.modifiers?.control || event.modifiers?.platform);
  }

  prNumber(w, pr, status) {
    const url = pr.url || `https://github.com/${pr.repository}/pull/${pr.number}`;
    const shortcut = window().platform === "macos" ? "Cmd" : "Ctrl";
    return div()
      .id(`space-pr-link-${w.id}-${pr.repository}-${pr.number}`)
      .text_size(TEXT.caption)
      .cursor_pointer()
      .tooltip(
        `${pr.repository}#${pr.number} · ${status.label}\n${pr.title}\n${url}\n${shortcut}-click to open`,
      )
      .on_mouse_down("left", (event, cx) => {
        if (!this.isPRLinkClick(event)) return;
        cx.stop_propagation();
        this.pressed = null;
        this.over = null;
      })
      .on_mouse_up("left", (event, cx) => {
        if (this.isPRLinkClick(event)) cx.stop_propagation();
      })
      .on_click((event, cx) => {
        if (!this.isPRLinkClick(event)) return;
        cx.stop_propagation();
        cx.open_url(url);
      })
      .child(status.ready ? `#${pr.number} ✓` : `#${pr.number}`);
  }

  prBadge(w, t, compact = false) {
    const prs = this.checkoutPRs(w);
    if (!prs.length) return null;
    const badge = h_flex().gap(5).flex_none().items_center();
    // Keep the sidebar width bounded when a branch targets several base repos.
    for (const pr of prs.slice(0, 1)) {
      const status = prAppearance(pr, t);
      badge.child(
        h_flex()
          .id(`space-pr-${w.id}-${pr.repository}-${pr.number}`)
          .gap(3)
          .items_center()
          .text_color(status.color)
          .tooltip(`${pr.repository}#${pr.number} · ${status.label}\n${pr.title}`)
          .child(Icon(`${status.icon}`).size(13).flex_none())
          .when(!compact, (el) => el.child(this.prNumber(w, pr, status))),
      );
    }
    if (!compact && prs.length > 1)
      badge.child(
        div()
          .text_size(TEXT.caption)
          .text_color(t.dim)
          .tooltip(
            prs
              .slice(1)
              .map((pr) => `${pr.repository}#${pr.number} · ${pr.title}`)
              .join("\n"),
          )
          .child(`+${prs.length - 1}`),
      );
    return badge;
  }

  // Under the row only when the PR lookup failed; the PR itself sits at the row's right.
  prLine(w, t, tree) {
    const status = this.checkoutStatus(w);
    return h_flex()
      .id(`space-pr-line-${w.id}`)
      .h(20)
      .pl(tree ? 44 : 27)
      .items_center()
      .tooltip(`PR refresh failed: ${status.error}`)
      .child(
        div()
          .text_size(TEXT.caption)
          .text_color(t.dim)
          .child(status.prs.length ? "PR may be stale" : "PR unavailable"),
      );
  }
  // ── Expanded/compact rows and sidebar rendering ──────────────────────────

  row(r, t) {
    const { w, i, g, rails } = r;
    const status = this.checkoutStatus(w);
    const hasPRLine = Boolean(status?.error);
    // One row is lit: under the lists view, the focused agent beneath takes it.
    const lit = w.active && !this.quiet?.(w);
    const row = v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .h(rowHeight({ rails }) + (hasPRLine ? 22 : 0))
      .flex_none()
      .justify_center()
      .rounded(6)
      .when(lit, (el) => el.bg(t.selected))
      .when(!lit, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.pressed === i && this.over !== i, (el) => el.opacity(0.5))
      .on_mouse_down("right", () => this.menu(w))
      .child(this.rowTitle(r, t))
      .when(hasPRLine, (el) => el.child(this.prLine(w, t, rails.length > 0)));
    if (this.pressed !== null && this.over === i && this.pressed !== i)
      row.child(this.dropLine(i, t));
    const dragged = this.withDragging(row, w, i);
    // Nested under the lists view, a row hangs from its main space's or group's line.
    if (!(rails.length && this.under)) return dragged;
    return h_flex()
      .w_full()
      .min_w(0)
      .children(rails.map((k) => Rail(k, 12)))
      .child(dragged.flex_1().min_w(0));
  }

  // Where the dragged space would land.
  dropLine(i, t) {
    return div()
      .absolute()
      .left(0)
      .right(0)
      .h(2)
      .bg(t.accent)
      .when(this.pressed < i, (line) => line.bottom(0))
      .when(this.pressed > i, (line) => line.top(0));
  }

  // Press to select or start a drag; spaces only move within their machine.
  withDragging(row, w, i) {
    return row
      .on_mouse_down("left", () => {
        this.pressed = i;
        this.over = i;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces()[this.pressed];
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? i : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === i && from !== i)
          run("space.move", { id: spaces()[from].id, index: i + 1 });
        else if (from === i) run("space.select", { id: w.id });
        cx.notify();
      });
  }

  rowTitle({ w, g, rails, worktree }, t) {
    const pinned = spaceGroups.isPinned(w.id);
    // Deep rows are narrow: the name and branch give way so the PR and fold stay in view.
    return h_flex()
      .w_full()
      .min_w(0)
      .gap(7)
      .items_center()
      .when(rails.length > 0 && !this.under, (el) => el.pl(22 * rails.length))
      // `leading`, set by the lists view, puts the fold control first, as groups have it.
      .children(this.leading?.(w) ?? [])
      .when(worktree, (el) => el.child(Icon("branch", 13).text_color(t.dim)))
      .when(!worktree, (el) => el.child(this.avatar(w, t)))
      .when(pinned, (el) => el.child(Icon("pin", 12).text_color(t.dim).tooltip("Pinned in its group")))
      .child(
        div().min_w(0).max_w(150).flex_shrink(1).truncate().tooltip(w.name).text_color(t.foreground).child(w.name),
      )
      .child(this.branchName(g, w.name, t))
      .child(this.gitTail(g, w.active, t, w));
  }

  avatar(w, t) {
    const color = (shared("space.colors") ?? {})[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (AVATAR_COLORS[color] ?? t[color]);
    return h_flex()
      .size(18)
      .flex_none()
      .rounded(5)
      .bg(fill)
      .items_center()
      .justify_center()
      .text_size(TEXT.avatar)
      .font_bold()
      .text_color("#ffffff")
      .child([...w.name][0]?.toUpperCase() ?? "?");
  }

  compact({ w, i }, t) {
    const badge = this.prBadge(w, t, true);
    return h_flex()
      .id(`space-${w.id}`)
      .h(26)
      .flex_none()
      .justify_center()
      .gap(4)
      .when(w.active, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("space.select", { id: w.id }))
      .child(
        div()
          .text_color(w.active ? t.foreground : t.muted)
          .child(String(i + 1)),
      )
      .when(Boolean(badge), (el) => el.child(badge))
      .when(!badge, (el) => el.child(div().text_color(tone(t, w.status)).child(glyph(w.status))));
  }

  // Share avatar colors with Herdr's own space menus. Do this during data
  // synchronization, never render: setShared itself schedules a redraw.
  updateColors(sp) {
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const ids = new Set(sp.map((p) => p.id));
    const kept = Object.fromEntries(
      Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)),
    );
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = (c) => Object.values(kept).filter((v) => v === c).length;
      kept[p.id] = palette.reduce((best, c) => (uses(c) < uses(best) ? c : best));
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
  }

  collapsed() {
    return (this.width ?? findNode(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
  }

  render() {
    const t = theme();
    const collapsed = this.collapsed();
    return v_flex()
      .id("better-sidebar-root")
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(TEXT.body)
      .on_size_change((size, cx) => this.resized(size, cx))
      .child(this.header(t, collapsed))
      .child(this.body(t, collapsed));
  }

  resized(size, cx) {
    const wasCollapsed = (this.width ?? Infinity) < 160;
    this.width = size.width;
    if (wasCollapsed !== this.width < 160) cx.notify();
  }

  newSpaceButton() {
    return IconButton({
      id: "space-new",
      icon: "plus",
      label: "New space",
      iconSize: 14,
      muted: true,
      onClick: () => run("space.new"),
    });
  }

  header(t, collapsed) {
    return h_flex()
      .h(31)
      .pl(16)
      .pr(10)
      .items_center()
      .justify_between()
      .text_size(TEXT.label)
      .text_color(t.dim)
      .when(!collapsed, (el) => el.child("Spaces"))
      .child(this.newSpaceButton());
  }

  body(t, collapsed) {
    return v_flex()
      .id("spaces-list")
      .flex_1()
      .min_h(0)
      .px(8)
      .pb(14)
      .overflow_y_scrollbar()
      .mode("always")
      .on_mouse_up("left", (_e, cx) => {
        this.pressed = null;
        cx.notify();
      })
      .children(this.above?.() ?? [])
      .children(this.grouped(t, collapsed));
  }
}
