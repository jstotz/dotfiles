// My Review: the Herdr app's Changes panel as a GitHub-style review. Started from
// vytasgavelis/herdr-reviewer 0.6.0 (MIT), itself built on Herdr's shipped
// "changes" mod (Apache License 2.0); see README.md, LICENSE and THIRD-PARTY-NOTICES.
//
// Changes, for code review: the diff rows are syntax colored (highlight.js,
// palette.js), and the diff is reviewed like a pull request: click a line
// (two clicks for a range, a @@ header for its hunk) to open the comment
// box, add the comment, and it sits inline under those lines; comments can be
// added on several files; the comment icon on a file row comments on the
// file as a whole (an image, a deleted file). "Submit
// review" sends every comment with its
// lines to the space's agent as one message (ask.js); right-click a line to
// ask about it at once instead. Esc closes the comment box.
// The comment box is a card floating over the top-right of the diff (a
// strip under it when the panel is narrow), so the rows never move: a
// list row may hold no input, so the box can't sit between the lines.
// The unchanged lines between hunks (and before the first, after the
// last) are read from the file and folded into a "N unchanged lines" row:
// a click opens that fold, and "Full file" in the header opens them all
// (remembered in shared "my-review.full"), so the whole file scrolls.
// Keys: "my-review.submit", "my-review.ask" (about the whole
// diff), "my-review.clear" (drops the draft comments), "my-review.full"
// (folds or unfolds the unchanged lines), "my-review.next" / "my-review.prev"
// (files; j/k with the panel focused), "my-review.viewed" (v), "my-review.edit"
// (e: the file in the tab's nvim, through herdr-nvim); in the send
// dialog (dialog.js) "my-review.send" and "my-review.close".
// Another mod opens a file's diff by setting shared "my-review.open" to
// { id, at: Date.now(), path (absolute), on (machine or null), ref? }: the panel
// picks it up on its next refresh, selects the file (or notes that it has no
// diff in the shown scope) and clears the key. `path` may be the repo folder
// itself, to select no file; `ref` (a commit-ish) switches to reviewing that
// commit on its own first. A request older than OPEN_TTL
// is dropped unread, so a stale one never fires when the repo gets focus later.
// The header's scope picker chooses what is reviewed: the uncommitted
// changes, the last commit plus them, everything on the branch since it
// left its base (the pull-request view), or any one commit from the log on
// its own; "my-review.scope" cycles the first three.
// Props: { palette: "one-dark-pro" | "theme" | "dark-plus" (default: one-dark-pro),
//          font_size: px (default: the terminal's font size minus one),
//          base: the branch reviews are against (default: origin/HEAD, else main, else master) }.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, Scrollbar, v_virtual_list, VirtualListScrollHandle, Popover } from "gpui-base";
import { spaces, panes, focused, exec, run, notify, appHome, readTextFile, watchFolder, theme, settings, nextCommand, props, shared, setShared } from "herdr";
import { tokenize, languageOf } from "./highlight.js";
import { ask } from "./ask.js";
import { palette } from "./palette.js";
import { Dialog } from "./dialog.js";
import { fingerprints, loadMarks, saveMark } from "./viewed.js";
import * as fs from "fs/promises";

// One file's diff state; see withView.
const VIEW = ["lines", "linesPath", "rows", "gaps", "index", "unfolded", "items", "sizes", "gutter", "diffWidth", "builtFull", "builtWidth"];

// This dotfiles copy: a focused pane with no folder of its own (a mod pane, such
// as a preview) keeps the last place, so the review stays put.
let lastPlace = null;
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  if (pane && !pane.terminal && lastPlace?.space === space?.id) return lastPlace.where;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  const where = { cwd: pane?.cwd || f?.cwd || space?.folder, on };
  lastPlace = { space: space?.id, where };
  return where;
}
const key = () => JSON.stringify(location());
const countLines = (text) => text ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
const NONE = "#00000000", SENT = "my-review.sent", DRAFTS = "my-review.drafts", SCOPE = "my-review.scope";
// The review scopes, in picker order; "commit" (one picked commit vs its
// parent) is chosen from the log, not cycled. A scope's id is its name, or
// "commit:<sha>" for a picked commit: the id keys the remembered scope and the drafts.
const SCOPES = ["work", "last", "branch"];
const LOG_SIZE = 100;
const OPEN = "my-review.open", OPEN_TTL = 30_000, FULL = "my-review.full";
// Diff lines shown at most; with the unchanged lines filled in, file lines at
// most (a bigger file shows its hunks only). A fold this short is just shown.
const DIFF_LINES = 1500, FILE_LINES = 30000, FILE_BYTES = 2_000_000, SHORT_GAP = 2;
// Flags for the automatic git reads (the same ones Herdr's Changes panel
// uses): never take index.lock, which an agent's commit may need at the same
// moment; never start a repo's fsmonitor just because it got focus; never
// rewrite the index from git diff. Clicked actions such as commit run as is.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
// The code font: the terminal's (`font` in settings, JetBrains Mono when
// unset), one size smaller than the terminal (`font_size`, 14 when unset);
// `props.font_size` overrides. Rows and widths scale with it.
const codeFont = () => (typeof settings().font === "string" && settings().font) || "JetBrains Mono";
const codeSize = () => Number(props()?.font_size) || Math.max(9, (Number(settings().font_size) || 14) - 1);
const rowOf = (size) => Math.round(size * 1.8);
const charOf = (size) => size * 0.62;

// A row's identity across reloads: its kind, number and text.
const desc = (r) => ({ kind: r.kind, number: r.number ?? null, text: r.text });
const descKey = (d) => `${d.kind}|${d.number}|${d.text}`;

// Numbers each diff line once and tokenizes it, so a frame only draws the rows on screen.
// A line starting with "=" is an unchanged line outside the hunks (filled
// in by fillGaps): a context row with `gap` set to its run's number and no hunk.
// The new side (context, added, unchanged) and the removed lines each keep
// their own tokenizer state, so a comment opened in one isn't carried into the other.
function diffRows(lines, lang) {
  let old = 1, next = 1, state = null, oldState = null, hunk = -1, gap = -1, inGap = false;
  return lines.map((line, i) => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; oldState = null; hunk = i; inGap = false; return { kind: "@", text: line, hunk: i, spans: [{ text: line, cls: "" }] }; }
    const kind = line[0];
    let row;
    if (kind === "=") { if (!inGap) { gap++; inGap = true; } old++; row = { kind: " ", number: next++, text: line.slice(1) || " ", gap }; }
    else if (kind === "-") row = { kind, number: old++, text: line.slice(1) || " " };
    else if (kind === "+") row = { kind, number: next++, text: line.slice(1) || " " };
    else if (kind === " ") { old++; row = { kind, number: next++, text: line.slice(1) || " " }; }
    else row = { kind: "", text: line };
    if (kind !== "=") inGap = false;
    row.hunk = kind === "=" ? -1 : hunk;
    const removed = kind === "-", t = tokenize(row.text.replace(/\t/g, "    "), lang, removed ? oldState : state);
    row.spans = t.spans;
    if (removed) oldState = t.state; else if (row.kind) state = t.state;
    return row;
  });
}

// The diff's lines with the file's unchanged lines around and between the
// hunks added as "=" lines. `text` is the new side of the file. Returns the
// diff as it was when the file doesn't match it (changed since the diff
// was read) or is too big.
function fillGaps(lines, text) {
  if (text.length > FILE_BYTES || text.includes("\0")) return lines;
  const file = text === "" ? [] : text.replace(/\n$/, "").split("\n");
  if (file.length > FILE_LINES) return lines;
  const out = [];
  let next = 1;
  for (const line of lines) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))?/.exec(line);
    if (match) {
      // An empty new side ("+12,0") starts after line 12, not at it.
      const start = match[2] === "0" ? +match[1] + 1 : +match[1];
      if (start < next) return lines;
      for (; next < start; next++) out.push(`=${file[next - 1]}`);
    } else if (line[0] === "+" || line[0] === " ") {
      if (file[next - 1] !== line.slice(1)) return lines;
      next++;
    }
    out.push(line);
  }
  for (; next <= file.length; next++) out.push(`=${file[next - 1]}`);
  return out;
}

export default class Changes extends View {
  init(_props, cx) {
    // Opened as the send dialog (ask.js): this copy is the dialog, nothing else.
    if (props()?.dialog) { this.dialog = Object.create(Dialog.prototype); this.dialog.init(_props, cx); return; }
    this.files = []; this.rows = []; this.index = new Map(); this.items = []; this.sizes = []; this.diffWidth = 0; this.gutter = 30; this.message = "";
    // Each expanded file's own diff state (VIEW fields), and the expand/collapse
    // choices made by hand (else unviewed files are expanded, viewed ones not).
    this.views = new Map(); this.toggled = new Map();
    this.comments = []; this.composer = null; this.handle = cx.focus_handle(); this.scroll = VirtualListScrollHandle.new();
    this.fontSize = codeSize(); this.row = rowOf(this.fontSize); this.unfolded = new Set();
    this.scope = "work"; this.sha = null; this.scopeInfo = null; this.choosingScope = false; this.range = ["HEAD"]; this.log = null;
    this.input = InputState.new({ placeholder: "Commit message" });
    this.input.on("change", (_e, cx) => {
      const hadMessage = Boolean(this.message.trim());
      this.message = this.input.value();
      if (hadMessage !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.note = TextareaState.new({ placeholder: "Leave a comment on these lines…", rows: 4 });
    this.note.set_auto_grow(4, 14);
    // Enter adds; shift-enter is the textarea's own newline, so its submit is ignored.
    this.note.on("submit", (e, cx) => { if (!e?.shift) this.addComment(cx); });
    this.note.on("change", (_e, cx) => { this.noteText = this.note.value(); if (this.composer?.editing) this.rebuild(); cx.notify(); });
    this.noteText = "";
    this.refresh(cx);
    cx.timer.every(10000, (cx) => this.refresh(cx));
    // Viewed marks set elsewhere (the my-review-viewed command, another window) show at once.
    cx.spawn(async (cx) => {
      await fs.mkdir(`${appHome()}/data/my-review`, { recursive: true }).catch(() => {});
      for (;;) { await watchFolder(`${appHome()}/data/my-review`); this.refresh(cx); }
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "ask") this.askAbout(null, cx);
        else if (c === "submit") this.submit(cx);
        else if (c === "clear") this.setComments([], cx);
        else if (c === "scope") this.cycleScope(cx);
        else if (c === "full") this.toggleFull(cx);
        else if (c === "next" || c === "prev") this.step(c === "next" ? 1 : -1, cx);
        else if (c === "viewed" && this.open) this.toggleViewed(this.open, cx);
        else if (c === "edit") this.editFile(this.open, cx);
        cx.notify();
      }
    });
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.watched === root) {
          await watchFolder(root);
          if (this.watched === root) this.refresh(cx);
        }
      } catch { this.watched = null; }
    });
  }

  refresh(cx) {
    if (this.loading || this.busy) return;
    const { cwd, on } = location(), context = key(), request = shared(OPEN);
    // The request this refresh answers; render never starts another refresh
    // for the same id, so a repo whose git keeps failing is read once, not in a loop.
    this.tried = request?.id ?? this.tried;
    // This dotfiles copy: a new place resets the view only once it turns out to be
    // another repo (below); moving between panes of the same repo keeps your place.
    if (context !== this.context) this.context = context;
    const reset = () => {
      this.root = null; this.log = null; this.files = []; this.views.clear(); this.toggled.clear(); this.bindView(null); this.comments = []; this.composer = null;
      this.message = ""; this.input.set_value(""); this.error = null; this.note_ = null; this.watched = null; this.closed = false; this.limited = false;
    };
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const top = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd, on });
        if (key() !== context) return;
        if (top.code !== 0) { reset(); this.error = "Not a git repository"; return; }
        if (top.stdout.trim() !== this.root || (on ?? null) !== (this.on ?? null)) reset();
        const root = top.stdout.trim(), git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        const status = await git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]);
        if (status.code !== 0) throw new Error(status.stderr);
        const head = await git(["rev-parse", "--verify", "HEAD"]);
        const hasHead = head.code === 0;
        // The scope in use (remembered per repo), and what this repo offers.
        // A request for a commit (`ref`) picks that commit's scope, as a click in the list would.
        const scopeKey = `${on ?? ""}:${root}`, requested = this.requestedFile(request, root, on);
        let wanted = null, refNote = null;
        if (requested !== null && typeof request.ref === "string" && request.ref) {
          const r = hasHead && !request.ref.startsWith("-") ? await git(["rev-parse", "--verify", "-q", `${request.ref}^{commit}`]) : null;
          if (r?.code === 0) { wanted = r.stdout.trim(); setShared(SCOPE, { ...(shared(SCOPE) ?? {}), [scopeKey]: `commit:${wanted}` }); }
          else refNote = `Requested commit ${request.ref} isn't in this repo.`;
        }
        const remembered = (shared(SCOPE) ?? {})[scopeKey];
        let [scope, sha] = wanted ? ["commit", wanted] : root === this.root ? [this.scope, this.sha] : remembered?.startsWith("commit:") ? ["commit", remembered.slice(7)] : [remembered ?? null, null];
        const info = hasHead ? await this.scopes(git, scope === "commit" ? sha : null) : { branch: null, base: null, last: null, merge: null, commit: null };
        if (!scope) scope = info.merge ? "branch" : "work";
        if (scope === "branch" && !info.merge) scope = "work";
        if (scope === "last" && !info.last) scope = "work";
        if (scope === "commit" && !info.commit) { scope = "work"; sha = null; }
        if (scope !== "commit") sha = null;
        // What is diffed: the working tree against one ref, or a picked commit against its parent.
        const range = scope === "commit" ? [info.commit.parent, info.commit.sha] : [scope === "branch" ? info.merge : scope === "last" ? `${info.last}~1` : "HEAD"];
        // Files: what differs in the range, plus (for the working tree) untracked files and conflicts from the status.
        const stats = {}, changed = new Map();
        const results = hasHead ? [await git(["diff", ...range, "--numstat", "-z", "--no-renames"])] : [await git(["diff", "--cached", "--numstat", "-z", "--no-renames"]), await git(["diff", "--numstat", "-z", "--no-renames"])];
        for (const result of results) {
          if (result.code !== 0) throw new Error(result.stderr);
          for (const entry of result.stdout.split("\0")) {
            const [a, d, ...parts] = entry.split("\t");
            if (!parts.length) continue;
            const path = parts.join("\t"), old = stats[path] ?? { add: 0, del: 0 };
            stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0), binary: a === "-" };
          }
        }
        if (hasHead) {
          const names = await git(["diff", ...range, "--name-status", "-z", "--no-renames"]);
          if (names.code !== 0) throw new Error(names.stderr);
          const parts = names.stdout.split("\0");
          // With diff.autoRefreshIndex off, a file whose stat changed but whose
          // content did not (touched, rewritten unchanged) is listed as M here
          // with no numstat line, until something else refreshes the index.
          for (let i = 0; i + 1 < parts.length && parts[i]; i += 2) { if (parts[i][0] !== "M" || stats[parts[i + 1]]) changed.set(parts[i + 1], parts[i][0]); }
        }
        // A picked commit is history: the working tree's state is not part of it.
        const entries = scope === "commit" ? [] : status.stdout.split("\0").filter(Boolean);
        for (const entry of entries) {
          const xy = entry.slice(0, 2), path = entry.slice(3);
          if (xy === "??") changed.set(path, "?");
          else if (xy.includes("U") || xy === "AA" || xy === "DD") changed.set(path, "U");
          else if (!hasHead) changed.set(path, xy.includes("D") ? "D" : xy.includes("A") ? "A" : "M");
        }
        const files = [];
        for (const [path, s0] of [...changed.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 1000)) {
          const fresh = s0 === "?", s = fresh ? "A" : s0 === "D" || s0 === "A" || s0 === "U" ? s0 : "M";
          const stat = stats[path] ?? { add: 0, del: 0 };
          files.push({ path, status: s, fresh, ...stat });
        }
        // Viewed marks (viewed.js): this list's fingerprints and the scope's saved marks.
        const prints = await fingerprints(git, { range, scope, hasHead, files }).catch(() => ({}));
        const marks = await loadMarks(`${on ?? ""}:${root}:${this.scopeId(scope, sha)}`).catch(() => ({}));
        if (key() !== context) return;
        if (root !== this.root || scope !== this.scope || sha !== this.sha || range.join(" ") !== this.range.join(" ")) { this.views.clear(); this.toggled.clear(); this.bindView(null); }
        const changedSet = root !== this.root || scope !== this.scope || sha !== this.sha;
        this.root = root; this.on = on; this.hasHead = hasHead; this.scope = scope; this.sha = sha; this.scopeInfo = info; this.range = range;
        // Each scope keeps its own comments: switching swaps the set, the others stay saved.
        if (changedSet) { this.comments = this.loadDrafts(this.scopeId()); this.composer = null; }
        this.files = files; this.prints = prints; this.marks = marks; this.limited = changed.size > 1000; this.error = null;
        this.watch(root, cx);
        if (requested !== null) {
          // "": the repo itself, no file to select.
          if (requested !== "") {
            const found = files.some(f => f.path === requested);
            if (found) { this.toggled.set(requested, true); this.focusFile(requested); }
            this.composer = null; this.note_ = found ? null : "Requested file has no diff in this scope (or is outside the first 1,000 files).";
          } else this.note_ = null;
          if (refNote) this.note_ = refNote;
          if (shared(OPEN)?.id === request.id) setShared(OPEN, null);
        }
        for (const p of [...this.views.keys()]) if (!files.some((f) => f.path === p)) this.views.delete(p);
        if (this.open && !files.some((f) => f.path === this.open)) this.bindView(null);
        // The current file: kept, else the first expanded one.
        if (!this.open && files.length) this.bindView((files.find((f) => this.isExpanded(f.path)) ?? files[0]).path);
        // Every expanded file's diff (the first 60).
        for (const f of files.filter((f) => this.isExpanded(f.path)).slice(0, 60)) {
          try { await this.load(f.path, context); }
          catch { if (key() === context) this.withView(f.path, () => this.setLines(["Cannot preview this diff (too large or unreadable)"], f.path)); }
        }
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // A request's path relative to the repo `root` on machine `on` ("" for the
  // repo folder itself), or null when it is not for that repo and machine (or
  // is stale). Windows paths compare case-insensitively.
  requestedFile(request, root0 = this.root, on = this.on) {
    if (!root0 || this.stale(request) || typeof request.path !== "string" || (request.on ?? null) !== (on ?? null)) return null;
    const windows = !on && /^[A-Za-z]:[\\/]/.test(root0);
    const root = (windows ? root0.replaceAll("\\", "/") : root0).replace(/\/$/, ""), path = (windows ? request.path.replaceAll("\\", "/") : request.path).replace(/\/$/, "");
    const fold = (s) => windows ? s.toLowerCase() : s;
    if (fold(path) === fold(root)) return "";
    return fold(path).startsWith(fold(root) + "/") ? path.slice(root.length + 1) : null;
  }
  // Malformed, or older than OPEN_TTL: dropped, whichever repo it was for.
  stale(request) {
    return typeof request?.id !== "string" || !request.id || typeof request.at !== "number" || Date.now() - request.at > OPEN_TTL;
  }

  // The shown scope's id: its name, or "commit:<sha>" for a picked commit.
  // A file's viewed box: checked while its saved mark matches its diff now.
  viewedState(path) {
    const mark = this.marks?.[path];
    return !mark ? "unviewed" : mark === this.prints?.[path] ? "viewed" : "changed";
  }
  // The new-file line to open the shown file at: the comment selection's first
  // line, else the last clicked row's, else
  // the first added line, else the first line shown. A removed line opens at
  // the line that follows it.
  editLine() {
    // A line or range selected for a comment wins: its first line.
    const selected = this.composer && !this.composer.whole && this.composer.path === this.open ? this.at(this.composer.from) : -1;
    const rows = this.rows, picked = selected >= 0 ? selected : this.lastRow?.path === this.open ? this.lastRow.i : -1;
    const from = picked >= 0 ? picked : Math.max(0, rows.findIndex((r) => r.kind === "+"));
    for (let j = from; j < rows.length; j++) if (rows[j].kind === "+" || rows[j].kind === " ") return rows[j].number;
    return 1;
  }
  // Opens a file in the tab's nvim, as the Files tree does (herdr-nvim's
  // `open`), and gives nvim the keyboard. This machine's repos only.
  editFile(path, cx) {
    if (!this.root || !path) return;
    if (this.on) { notify({ title: "Open in nvim", body: "herdr-nvim opens files on this computer only.", level: "warning" }); return; }
    const f = focused(), line = path === this.open ? this.editLine() : 1;
    const where = f?.space && f?.tab ? JSON.stringify({ space: f.space, tab: f.tab, terminal: null, cwd: null }) : null;
    if (!where) return;
    // An image or SVG previews in nvim's place, as the Files tree does; opening
    // it in nvim as well would make herdr-nvim show a second preview.
    if (/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(path)) { run(`herdr-nvim.swap:${f.tab}:${encodeURIComponent(`${this.root}/${path}`)}`); return; }
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${appHome()}/mods/herdr-nvim/bin/herdr-nvim`, ["open", "--no-focus", `${this.root}/${path}:${line}`, "--ctx", where]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().slice(-300) || `exit ${r.code}`);
        let out = {};
        try { out = JSON.parse(r.stdout); } catch {}
        if (out.terminal) run("pane.focus", { terminal: out.terminal });
      } catch (e) { this.note_ = `Couldn't open in nvim: ${e.message ?? e}`; cx.notify(); }
    });
  }
  // One file's row: chevron, viewed box, status, path, buttons and counts.
  fileRow(f, t, perFile) {
        const parts = f.path.split("/"), name = parts.pop(), k = perFile[f.path], viewed = this.viewedState(f.path);
        return h_flex().id(`change-${f.path}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when((this.focus ?? this.open) === f.path && !this.isExpanded(f.path), (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.handle.focus(); this.pick(f.path, cx); })
          // Whether this file's diff is the one shown below (a click on the row toggles it).
          .child(svg(`mods/my-review/chevron-${this.isExpanded(f.path) ? "down" : "right"}.svg`).size(12).flex_none().text_color(this.isExpanded(f.path) ? t.foreground : t.dim))
          // The viewed box (viewed.js): checked while this diff is the one you viewed.
          .child(div().id(`viewed-${f.path}`).size(15).flex_none().flex().items_center().justify_center().rounded(4).border_1().cursor_pointer()
            .border_color(viewed === "viewed" ? t.accent : viewed === "changed" ? t.blocked : t.input).when(viewed === "viewed", (e) => e.bg(t.accent).text_color(t.accent_foreground))
            .hover((s) => s.border_color(t.accent))
            .tooltip(viewed === "viewed" ? "Viewed · click to unmark" : viewed === "changed" ? "Changed since you viewed it · click to mark viewed" : "Mark as viewed")
            .on_click((_e, cx) => { cx.stop_propagation(); this.handle.focus(); this.toggleViewed(f.path, cx); })
            .when(viewed === "viewed", (e) => e.child(svg("mods/my-review/check.svg").size(11))))
          .child(div().w(14).text_size(11).text_color(f.status === "A" ? t.ansi2 : f.status === "D" ? t.ansi1 : f.status === "U" ? t.ansi1 : t.blocked).child(f.status))
          .child(h_flex().flex_1().min_w(0).when(viewed === "viewed", (e) => e.opacity(0.55)).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(name)))
          .when(viewed === "changed", (e) => e.child(div().text_size(10.5).text_color(t.blocked).child("changed")))
          // Open in the tab's nvim (e), at the line clicked last or the first change.
          .child(div().id(`edit-file-${f.path}`).size(18).flex_none().flex().items_center().justify_center().rounded(4).cursor_pointer().text_color(t.muted)
            .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Open in nvim (e)")
            .on_click((_e, cx) => { cx.stop_propagation(); this.editFile(f.path, cx); }).child(svg("mods/my-review/edit.svg").size(12)))
          // One speech bubble: the draft count when there are drafts, and a click comments on the whole file.
          .child(h_flex().id(`comment-file-${f.path}`).h(18).min_w(18).px(k ? 5 : 0).gap(3).items_center().justify_center().rounded(4).cursor_pointer()
            .when(Boolean(k), (e) => e.bg(t.accent + "33").text_size(10).text_color(t.foreground))
            .when(!k, (e) => e.text_color(t.muted))
            .hover((s) => s.bg(k ? t.accent + "55" : t.hover).text_color(t.foreground))
            .tooltip(k ? `${k} draft comment${k > 1 ? "s" : ""} · click to comment on the whole file` : "Comment on the whole file")
            .on_click((_e, cx) => { cx.stop_propagation(); this.commentFile(f.path, cx); })
            .when(Boolean(k), (e) => e.child(String(k))).child(svg("mods/my-review/comment.svg").size(k ? 10 : 12)))
          .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
  }
  // --- Several files open at once. The methods above work on "the open file"
  // (this.open and the VIEW fields); each expanded file keeps its own copy of
  // those fields, swapped in to draw its card or handle a click in it. this.open
  // is also the current file: the one j/k/v/e and the header act on.
  freshView() {
    return { lines: null, linesPath: null, rows: [], gaps: [], index: new Map(), unfolded: new Set(), items: [], sizes: [], gutter: 30, diffWidth: 0, builtFull: this.full() };
  }
  storeView() {
    if (!this.open) return;
    const v = {};
    for (const k of VIEW) v[k] = this[k];
    this.views.set(this.open, v);
  }
  bindView(path) {
    const v = (path && this.views.get(path)) || this.freshView();
    for (const k of VIEW) this[k] = v[k];
    this.open = path;
  }
  // Runs fn with `path`'s diff state in place, then puts the current file's back.
  withView(path, fn) {
    if (path === this.open) return fn();
    const prev = this.open;
    this.storeView(); this.bindView(path);
    try { return fn(); } finally { this.storeView(); this.bindView(prev); }
  }
  focusFile(path) {
    if (path === this.open) return;
    this.storeView(); this.bindView(path);
  }
  isExpanded(path) {
    return this.toggled.has(path) ? this.toggled.get(path) : this.viewedState(path) !== "viewed";
  }
  // Collapsing a card you're partway through (its header pinned) scrolls back to
  // its row, so what follows doesn't jump up past where you were.
  keepPlace(path) {
    const b = this.layout().blocks.find((b) => b.f.path === path);
    if (b && b.top < (this.scrollY ?? 0)) this.scrollTo = path;
  }
  // Expand a file if needed and make it current, loading its diff the first time.
  focusAndShow(path, cx) {
    if (!this.isExpanded(path)) this.toggled.set(path, true);
    this.scrollTo = path;
    this.focusFile(path);
    this.ensureLoaded(path, cx);
  }
  ensureLoaded(path, cx) {
    if (this.withView(path, () => this.lines)) return;
    const context = this.context;
    cx.spawn(async (cx) => {
      try { await this.load(path, context); }
      catch (e) { if (key() === context) this.withView(path, () => this.setLines([`Cannot preview this diff (too large or unreadable): ${e}`], path)); }
      cx.notify();
    });
  }
  // --- The list draws itself: one scroll position (scrollY, and scrollX for long
  // lines), only what's on screen, and the header of the card you're scrolling
  // through pinned to the top until the card ends, as on GitHub.
  layout() {
    const HEAD = 34, GAP = 4, ROW = 28, blocks = [];
    let y = GAP;
    for (const f of this.files) {
      if (!this.isExpanded(f.path)) { blocks.push({ f, kind: "row", top: y, bottom: y + ROW }); y += ROW; continue; }
      const sizes = this.withView(f.path, () => {
        if (this.full() !== this.builtFull || this.builtWidth !== this.size?.width) { this.builtWidth = this.size?.width; this.rebuild(); }
        return this.lines ? this.items.map((it) => it.height) : [this.row];
      });
      const top = y + GAP, body = top + HEAD, bottom = body + sizes.reduce((a, b) => a + b, 0) + 6;
      blocks.push({ f, kind: "card", top, body, bottom });
      y = bottom + GAP;
    }
    return { blocks, total: y + 8 };
  }
  // A card's header; pinned, it's square so no diff row shows past its corners.
  cardHead(b, t, perFile, focus, y, pinned = false) {
    return div().absolute().left(6).right(6).top(y).h(34).p(2).bg(t.raised).border_1().border_color(b.f.path === focus ? t.accent + "88" : t.border).when(!pinned, (e) => e.rounded_t(8))
      .child(this.fileRow(b.f, t, perFile));
  }
  // A card's frame, its visible diff rows and its header, with its file's state in place.
  cardParts(b, t, colors, perFile, n, focus, sy, H) {
    const path = b.f.path, target = this.target(), commented = new Set(), parts = [];
    for (const it of this.items) if (it.kind === "comment") for (let j = it.from; j <= it.to; j++) commented.add(j);
    parts.push(div().absolute().left(6).right(6).top(b.body - sy).h(b.bottom - b.body).bg(t.background).border_1().border_t(0).border_color(t.border).rounded_b(8));
    if (!this.lines) parts.push(div().absolute().left(18).top(b.body - sy + 4).text_color(t.dim).child("Loading…"));
    let y = b.body;
    for (const it of this.items) {
      const top = y; y += it.height;
      if (y <= sy || top >= sy + H) continue;
      const key = it.key;
      parts.push(div().id(`it-${path}-${key}`).absolute().left(7).right(7).top(top - sy).h(it.height).overflow_hidden().font_family(codeFont()).text_size(this.fontSize)
        .on_click((_e, cx) => { this.focusFile(path); if (key.startsWith("f:")) this.unfold(Number(key.slice(2)), cx); else if (key.startsWith("c:")) { if (key.slice(2) !== this.composer?.editing) this.editComment(key.slice(2), cx); } else this.clickRow(Number(key.slice(2)), cx); })
        .on_mouse_down("right", (_e, cx) => { this.focusFile(path); if (!key.startsWith("r:")) return; const i = Number(key.slice(2)); const r = this.rows[i]; if (!r || r.kind === "") return; this.askAbout(r.kind === "@" ? this.rows.map((_r, j) => j).filter((j) => this.rows[j].hunk === i && this.rows[j].kind !== "") : [i], cx); })
        .child(this.item(it, t, colors, target, commented)));
    }
    // Scrolled above the top, the header is drawn pinned instead (viewport); two copies
    // would share element ids, and a click needs its press and release on one element.
    if (b.top >= sy) parts.push(this.cardHead(b, t, perFile, focus, b.top - sy));
    return parts;
  }
  viewport(t, colors, perFile, n, focus, empty) {
    const { blocks, total } = this.layout(), H = this.viewH ?? 600;
    if (this.scrollTo) { const b = blocks.find((b) => b.f.path === this.scrollTo); if (b) this.scrollY = b.top - 4; this.scrollTo = null; }
    this.scrollY = Math.min(Math.max(0, total - H), Math.max(0, this.scrollY ?? 0));
    const widest = Math.max(0, ...[...this.views.values()].map((v) => v.diffWidth ?? 0), this.diffWidth ?? 0);
    this.scrollX = Math.min(Math.max(0, widest - ((this.size?.width ?? 400) - 20)), Math.max(0, this.scrollX ?? 0));
    const sy = this.scrollY, kids = [];
    for (const b of blocks) {
      if (b.bottom <= sy || b.top >= sy + H) continue;
      if (b.kind === "row") kids.push(div().absolute().left(6).right(6).top(b.top - sy).h(28).child(this.fileRow(b.f, t, perFile)));
      else kids.push(...this.withView(b.f.path, () => this.cardParts(b, t, colors, perFile, n, focus, sy, H)));
    }
    // The card you're inside keeps its header at the top, pushed up as the card ends.
    // The list is clipped below that header, so nothing under it takes its clicks.
    const inside = blocks.find((b) => b.kind === "card" && b.top < sy && b.bottom > sy);
    const pinY = inside ? Math.min(0, inside.bottom - 34 - sy) : 0, clip = inside ? Math.max(0, pinY + 34) : 0;
    const list = div().absolute().left(0).right(0).top(clip).bottom(0).overflow_hidden()
      .child(div().absolute().left(0).right(0).top(-clip).h(H).children(kids.splice(0)));
    kids.push(list);
    if (inside) kids.push(this.cardHead(inside, t, perFile, focus, pinY, true).shadow_md());
    // The comment box floats over the top right of the list (a strip under it on a narrow panel).
    if (this.composer && !this.narrow()) kids.push(this.withView(this.composer.path, () => this.box(t, this.target(), false)));
    if (focus && n === 0 && !this.composer && this.rows.length) kids.push(div().absolute().bottom(6).right(14).px(8).py(3).rounded(6).bg(t.raised + "e0").text_size(10).text_color(t.dim).child("Click a line to comment · right-click to ask · j/k files · v viewed · e nvim"));
    if (total > H) kids.push(div().absolute().right(1).w(4).rounded(2).bg(t.dim + "66").top((sy / total) * H).h(Math.max(24, (H / total) * H)));
    return div().id("changes-scroll").relative().flex_1().min_h(0).overflow_hidden()
      .on_size_change((size, cx) => { if (this.viewH !== size.height) { this.viewH = size.height; cx.notify(); } })
      .on_scroll_wheel((e, cx) => { this.scrollY = (this.scrollY ?? 0) - (e.delta?.y ?? 0); this.scrollX = (this.scrollX ?? 0) - (e.delta?.x ?? 0); cx.notify(); })
      .children(kids)
      .when(!this.files.length, (e) => e.child(empty))
      .when(this.files.length > 0 && this.files.every((f) => this.viewedState(f.path) === "viewed"), (e) => e.child(div().absolute().top(blocks.at(-1).bottom - sy + 8).px(14).text_color(t.dim).child(`All ${this.files.length} files viewed`)));
  }
  // The next (+1) or previous (-1) file in the list, from the shown one.
  step(by, cx) {
    if (!this.files.length) return;
    const at = this.files.findIndex((f) => f.path === this.open);
    const next = this.files[at < 0 ? (by > 0 ? 0 : this.files.length - 1) : Math.min(this.files.length - 1, Math.max(0, at + by))];
    if (next && next.path !== this.open) { this.focusAndShow(next.path, cx); cx.notify(); }
  }
  toggleViewed(path, cx) {
    const print = this.prints?.[path];
    if (!print || !this.root) return;
    const viewed = this.viewedState(path) === "viewed";
    this.marks = { ...(this.marks ?? {}), [path]: viewed ? undefined : print };
    cx.notify();
    const key = this.draftKey(), listed = new Set(this.files.map((f) => f.path));
    // Marking collapses the file's card (viewed files start collapsed); unmarking
    // expands it again.
    if (!viewed) this.keepPlace(path);
    this.toggled.delete(path);
    if (viewed) this.ensureLoaded(path, cx);
    cx.spawn(async (cx) => {
      try { this.marks = await saveMark(key, path, viewed ? null : print, listed); }
      catch (e) { this.note_ = `Couldn't save the viewed mark: ${e.message ?? e}`; }
      cx.notify();
    });
  }
  scopeId(scope = this.scope, sha = this.sha) { return scope === "commit" ? `commit:${sha}` : scope; }
  // The draft comments of one scope (by id) of the shown repo. Drafts saved before
  // scopes existed (keyed by repo alone) were all on the uncommitted changes.
  draftKey(id = this.scopeId()) { return `${this.on ?? ""}:${this.root}:${id}`; }
  loadDrafts(id) {
    const drafts = { ...(shared(DRAFTS) ?? {}) }, old = `${this.on ?? ""}:${this.root}`;
    if (drafts[old]) { drafts[`${old}:work`] = [...(drafts[`${old}:work`] ?? []), ...drafts[old]]; delete drafts[old]; setShared(DRAFTS, drafts); }
    return drafts[this.draftKey(id)] ?? [];
  }

  // What this repo can be reviewed against: its branch, the base branch
  // (props.base, else origin/HEAD, else main, else master), the merge
  // base with it (null when on the base itself), HEAD's short hash
  // when it has a parent, and the picked commit `sha` (null when it is gone).
  async scopes(git, sha) {
    const out = async (args) => { const r = await git(args); return r.code === 0 ? r.stdout.trim() : null; };
    const branch = await out(["rev-parse", "--abbrev-ref", "HEAD"]);
    let base = typeof props()?.base === "string" ? props().base : null;
    if (!base) { const h = await out(["symbolic-ref", "-q", "refs/remotes/origin/HEAD"]); if (h) base = h.replace(/^refs\/remotes\/origin\//, ""); }
    if (!base) for (const b of ["main", "master"]) { if (await out(["rev-parse", "--verify", "-q", `refs/heads/${b}`]) !== null) { base = b; break; } }
    let merge = null;
    if (base && branch !== base) {
      const baseRef = (await out(["rev-parse", "--verify", "-q", `refs/heads/${base}`])) !== null ? base : `origin/${base}`;
      merge = await out(["merge-base", baseRef, "HEAD"]);
      if (merge && (await out(["rev-parse", "HEAD"])) === merge) merge = null;
    }
    const last = (await out(["rev-parse", "--verify", "-q", "HEAD~1"])) !== null ? await out(["rev-parse", "--short", "HEAD"]) : null;
    const subject = last ? await out(["log", "-1", "--format=%s"]) : null;
    let commit = null;
    if (sha) {
      const found = await out(["log", "-1", "--format=%H%x1f%h%x1f%s", `${sha}^{commit}`, "--"]);
      if (found) {
        const [full, short, title] = found.split("\x1f");
        // A root commit is diffed against the empty tree.
        const parent = (await out(["rev-parse", "--verify", "-q", `${full}~1`])) ?? (await out(["hash-object", "-t", "tree", "/dev/null"]));
        if (parent) commit = { sha: full, short, subject: title, parent };
      }
    }
    return { branch, base, merge, last, subject, commit };
  }

  // The scope's name for the header and the submit message.
  scopeLabel(scope = this.scope) {
    const i = this.scopeInfo ?? {};
    return scope === "branch" ? `vs ${i.base}` : scope === "last" ? "Last commit" : scope === "commit" ? `Commit ${i.commit?.short ?? ""}` : "Uncommitted";
  }
  scopeWords() {
    const i = this.scopeInfo ?? {};
    return this.scope === "branch" ? `all changes on branch ${i.branch} since it left ${i.base} (merge base ${(i.merge ?? "").slice(0, 7)}), committed or not`
      : this.scope === "last" ? `the last commit (${i.last}${i.subject ? `, "${i.subject}"` : ""}) plus the uncommitted changes`
      : this.scope === "commit" ? `commit ${i.commit?.short}${i.commit?.subject ? ` ("${i.commit.subject}")` : ""} on its own, against its parent`
      : "uncommitted changes";
  }
  // `sha`: the commit, for the "commit" scope.
  setScope(scope, cx, sha = null) {
    const id = this.scopeId(scope, sha);
    if (!this.root || id === this.scopeId()) { this.choosingScope = false; cx.notify(); return; }
    const all = { ...(shared(SCOPE) ?? {}) }; all[`${this.on ?? ""}:${this.root}`] = id; setShared(SCOPE, all);
    this.scope = scope; this.sha = sha; this.choosingScope = false; this.composer = null; this.setLines([]);
    this.comments = this.loadDrafts(id); this.rebuild();
    this.refresh(cx); cx.notify();
  }
  // From a picked commit, the next scope is Uncommitted.
  cycleScope(cx) {
    const ok = SCOPES.filter((s) => s === "work" || (s === "last" ? this.scopeInfo?.last : this.scopeInfo?.merge));
    this.setScope(ok[(ok.indexOf(this.scope) + 1) % ok.length], cx);
  }
  // The commits for the picker, read when it opens: on a branch that has left
  // its base, the branch's own (first-parent, since the merge base); else the
  // last LOG_SIZE on HEAD. First-parent: commits merged in show as their merge.
  loadLog(cx) {
    const root = this.root, on = this.on, context = this.context, merge = this.scopeInfo?.merge;
    if (!root || !this.hasHead) return;
    cx.spawn(async (cx) => {
      const r = await exec("git", [...READ, "log", "--first-parent", `-n${LOG_SIZE}`, "--format=%H%x1f%h%x1f%s%x1f%ar%x1f%an", ...(merge ? [`${merge}..HEAD`] : []), "--"], { cwd: root, on });
      if (key() !== context || root !== this.root) return;
      this.log = r.code !== 0 ? [] : r.stdout.split("\n").filter(Boolean).map((l) => { const [sha, short, subject, when, author] = l.split("\x1f"); return { sha, short, subject, when, author }; });
      cx.notify();
    });
  }

  async load(path, context) {
    const file = this.files.find((f) => f.path === path), root = this.root, on = this.on;
    if (!file) return;
    let lines;
    if (file.fresh || (!this.hasHead && file.status === "A")) {
      const text = await readTextFile(`${root}/${path}`, { on }).catch(() => null);
      if (text === null) lines = ["Cannot preview this file (binary, too large, or unreadable)"];
      else if (text.includes("\0")) lines = ["Binary file · no text diff"];
      else {
        file.add = countLines(text);
        lines = [`@@ -0,0 +1,${file.add} @@`, ...text.slice(0, 400000).replace(/\n$/, "").split("\n").slice(0, 1500).map(l => `+${l}`)];
      }
    } else {
      const range = this.hasHead ? this.range : [];
      const r = await exec("git", [...READ, "diff", ...range, "--no-ext-diff", "--no-textconv", "--no-color", "--", path], { cwd: root, on });
      if (r.code !== 0) throw new Error(r.stderr);
      const all = r.stdout.replace(/\n$/, "").split("\n"), first = all.findIndex((l) => l.startsWith("@@"));
      lines = first < 0 ? [file.binary ? "Binary file changed" : "No text diff available"] : all.slice(first);
      // The unchanged lines around the hunks, from the new side of the file:
      // the picked commit's blob, else the working tree. A cut diff or a deleted file has none.
      if (first >= 0 && lines.length <= DIFF_LINES && file.status !== "D") {
        const commit = this.scope === "commit" && range.length === 2 ? range[1] : null;
        const text = commit ? await exec("git", [...READ, "show", `${commit}:${path}`], { cwd: root, on }).then((s) => s.code === 0 ? s.stdout : null).catch(() => null)
          : await readTextFile(`${root}/${path}`, { on }).catch(() => null);
        if (typeof text === "string") lines = fillGaps(lines, text);
      }
    }
    if (lines.length > (lines.some((l) => l[0] === "=") ? FILE_LINES + DIFF_LINES : DIFF_LINES)) lines = lines.slice(0, DIFF_LINES);
    if (key() === context) this.withView(path, () => this.setLines(lines.map(line => line.length > 4000 ? line.slice(0, 4000) + "… (line truncated)" : line), path));
  }

  setLines(lines, path) {
    const same = this.lines && lines.length === this.lines.length && lines.every((l, i) => l === this.lines[i]);
    if (same) return;
    if (path !== this.linesPath) this.unfolded = new Set();
    this.lines = lines; this.linesPath = path;
    this.rows = diffRows(lines, languageOf(path));
    // Each fold's rows, by gap number.
    this.gaps = [];
    this.rows.forEach((r, i) => { if (r.gap !== undefined) (this.gaps[r.gap] ??= []).push(i); });
    this.index = new Map();
    this.rows.forEach((r, i) => { const k = descKey(desc(r)); if (!this.index.has(k)) this.index.set(k, i); });
    this.measure();
  }

  // Sizes that depend on the font: the gutter (wide enough for the largest
  // line number), the diff's width, and the rows.
  measure() {
    const ch = charOf(this.fontSize), digits = String(Math.max(0, ...this.rows.map((r) => r.number ?? 0))).length;
    this.gutter = Math.max(30, Math.ceil(digits * ch + 10));
    this.diffWidth = Math.max(300, ...(this.lines ?? []).map((line) => Math.ceil(line.length * ch) + this.gutter + 36));
    this.rebuild();
  }

  // Where a row descriptor is in the current diff, or -1.
  at(d) { return d ? (this.index.get(descKey(d)) ?? -1) : -1; }

  // Whether a fold shows its lines: "Full file", opened by a click, too short
  // to fold, or holding lines that a comment or the comment box is on.
  shown(g, keep) {
    return this.full() || this.unfolded.has(g) || (this.gaps[g]?.length ?? 0) <= SHORT_GAP || keep.has(g);
  }
  full() { return shared(FULL) === true; }
  toggleFull(cx) {
    setShared(FULL, !this.full());
    for (const p of new Set([...this.views.keys(), this.open].filter(Boolean))) this.withView(p, () => { this.unfolded = new Set(); this.rebuild(); });
    cx.notify();
  }
  unfold(g, cx) { this.unfolded.add(g); this.rebuild(); cx.notify(); }

  // The list's items: diff rows, with each comment under its last line;
  // comments on the whole file come first. The comment being edited stays
  // in place as a live preview of what is typed in the box. A closed fold
  // is one "N unchanged lines" item in place of its rows.
  rebuild() {
    // Folds a comment or the comment box reaches into stay open.
    const keep = new Set(), reach = (from, to) => { for (let j = Math.max(0, from); j <= to; j++) { const g = this.rows[j]?.gap; if (g !== undefined) keep.add(g); } };
    for (const c of this.comments) if (c.path === this.open && !c.whole) reach(this.at(c.from), this.at(c.to));
    const target = this.target();
    if (target) reach(target.from, target.to);
    const items = [];
    this.builtFull = this.full();
    this.rows.forEach((r, i) => {
      if (r.gap === undefined || this.shown(r.gap, keep)) items.push({ key: `r:${i}`, kind: "row", i, height: this.row });
      else if (this.gaps[r.gap][0] === i) items.push({ key: `f:${r.gap}`, kind: "fold", gap: r.gap, count: this.gaps[r.gap].length, height: this.row });
    });
    const under = new Map(), editing = this.composer?.editing ?? null;
    this.items = [];
    for (const c of this.comments) {
      if (c.path !== this.open) continue;
      const live = c.id === editing, text = live ? this.noteText : c.text;
      const it = { key: `c:${c.id}`, kind: "comment", id: c.id, live, text, height: this.commentHeight(text) };
      if (c.whole) { this.items.push({ ...it, whole: true, from: -1, to: -1 }); continue; }
      const from = this.at(c.from), to = this.at(c.to);
      if (from < 0 || to < 0 || to < from) continue;
      (under.get(to) ?? under.set(to, []).get(to)).push({ ...it, from, to });
    }
    for (const item of items) { this.items.push(item); if (item.kind === "row") for (const c of under.get(item.i) ?? []) this.items.push(c); }
    this.sizes = this.items.map((it) => it.height);
  }

  commentHeight(text) {
    const cpl = Math.max(24, Math.floor(((this.size?.width ?? 368) - 90) / charOf(this.fontSize)));
    const lines = text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0);
    return 44 + lines * Math.round(this.fontSize * 1.45);
  }
  // The composer's target rows in the current diff, or null (also for a whole-file comment).
  target() {
    if (!this.composer || this.composer.whole || this.composer.path !== this.open) return null;
    const from = this.at(this.composer.from), to = this.at(this.composer.to);
    return from < 0 || to < 0 ? null : { from: Math.min(from, to), to: Math.max(from, to) };
  }

  // Click on a diff row: open the comment box there, or widen it to a range.
  clickRow(i, cx) {
    const row = this.rows[i];
    if (!row || row.kind === "") return;
    this.lastRow = { path: this.open, i };
    let from = i, to = i;
    if (row.kind === "@") {
      const members = this.rows.map((r, j) => j).filter((j) => j !== i && this.rows[j].hunk === i && this.rows[j].kind !== "");
      if (!members.length) return;
      from = members[0]; to = members[members.length - 1];
    }
    const t = this.target();
    if (t && !this.composer.editing && !this.noteText.trim()) {
      // A click inside the highlighted lines clears them; outside, it widens them.
      if (from >= t.from && to <= t.to) { this.closeComposer(cx); return; }
      from = Math.min(t.from, from); to = Math.max(t.to, to);
    }
    // Editing a line comment keeps its identity when retargeted; a whole-file comment stays what it is.
    const editing = this.composer?.editing && !this.composer.whole && this.composer.path === this.open ? this.composer.editing : null;
    this.composer = { path: this.open, from: desc(this.rows[from]), to: desc(this.rows[to]), editing };
    this.openBox(cx);
  }

  // Opening the box: rebuild and give the textarea the keyboard (again
  // once the frame is drawn). The list is not scrolled: what was clicked
  // is on screen already, and a scroll would make the rows jump.
  // `scrollTo`: an item index to bring on screen anyway (a whole-file
  // comment, whose card is at the top of the diff).
  openBox(cx, scrollTo = -1) {
    this.rebuild();
    this.note.focus();
    cx.timer.after(300, () => this.note.focus());
    cx.notify();
  }

  // Comment on a file as a whole (an image, a deleted file, anything without lines to click).
  commentFile(path, cx) {
    if (this.composer?.whole && this.composer.path === path && !this.composer.editing && !this.noteText.trim()) { this.closeComposer(cx); return; }
    this.focusAndShow(path, cx);
    this.composer = { path, whole: true, editing: null };
    this.openBox(cx, 0);
  }

  editComment(id, cx) {
    const c = this.comments.find((c) => c.id === id);
    if (!c) return;
    this.composer = c.whole ? { path: c.path, whole: true, editing: id } : { path: c.path, from: c.from, to: c.to, editing: id };
    this.note.set_value(c.text); this.noteText = c.text;
    this.openBox(cx);
  }

  closeComposer(cx) {
    this.composer = null; this.note.set_value(""); this.noteText = ""; this.rebuild(); this.handle.focus(); cx.notify();
  }

  setComments(list, cx) {
    this.comments = list; this.rebuild();
    const drafts = { ...(shared(DRAFTS) ?? {}) }, k = this.draftKey();
    if (list.length) drafts[k] = list; else delete drafts[k];
    setShared(DRAFTS, drafts);
    cx?.notify();
  }

  addComment(cx) {
    const text = this.note.value().trim(), c = this.composer;
    if (!c || !text) return;
    const list = this.comments.filter((x) => x.id !== c.editing);
    const id = c.editing ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const comment = c.whole ? { id, path: c.path, whole: true, text } : { id, path: c.path, from: c.from, to: c.to, text };
    const t = this.target();
    if (t) { comment.from = desc(this.rows[t.from]); comment.to = desc(this.rows[t.to]); comment.quote = this.quote(this.rows.slice(t.from, Math.min(t.to, t.from + 60) + 1)); }
    else if (c.editing) { const old = this.comments.find((x) => x.id === c.editing); if (old?.quote) comment.quote = old.quote; }
    list.push(comment);
    this.setComments(list);
    this.closeComposer(cx);
  }

  deleteComment(cx) {
    const id = this.composer?.editing;
    if (id) this.setComments(this.comments.filter((c) => c.id !== id));
    this.closeComposer(cx);
  }

  // The text the agent gets for a set of rows (indexes; null: every row of the open diff).
  quote(rows) {
    return rows.map((r) => r.kind === "@" ? r.text : `${r.number === undefined ? "" : String(r.number).padStart(5)} ${r.kind || " "} ${r.text}`).join("\n");
  }
  span(rows) {
    const nums = rows.filter((r) => r.number !== undefined && r.kind !== "-").map((r) => r.number), olds = rows.filter((r) => r.kind === "-").map((r) => r.number);
    const range = (a) => a.length > 1 ? `lines ${Math.min(...a)}-${Math.max(...a)}` : `line ${a[0]}`;
    return nums.length ? range(nums) : olds.length ? `removed ${range(olds)}` : "";
  }
  where(path) { return `${this.root}/${path}${this.on ? ` (on ${this.on})` : ""}`; }
  // A file's change in words, for a whole-file comment: "added, binary".
  describe(path) {
    const f = this.files.find((f) => f.path === path);
    if (!f) return "no longer changed";
    const what = f.status === "A" ? "added" : f.status === "D" ? "deleted" : f.status === "U" ? "conflict" : "modified";
    return f.binary ? `${what}, binary` : f.add || f.del ? `${what}, +${f.add} −${f.del}` : what;
  }

  askAbout(indexes, cx) {
    if (!this.open || !this.rows.length) return;
    // The whole diff: its hunks, not the unchanged lines filled in around them.
    const rows = (indexes ? indexes.sort((a, b) => a - b).map((i) => this.rows[i]) : this.rows.filter((r) => r.gap === undefined)).filter(Boolean).slice(0, 400);
    const span = this.span(rows), title = `${this.open}${span ? `:${span.replace(/^(removed )?lines? /, "")}` : ""}`;
    const head = indexes ? `In ${this.where(this.open)}, ${span || "these lines"} of the diff (${this.scopeWords()}; new-file line numbers; - lines are removed):` : `The diff of ${this.where(this.open)} (${this.scopeWords()}):`;
    cx.spawn(async (cx) => { try { await ask({ title, context: `${head}\n${this.quote(rows)}` }); } catch (e) { this.note_ = `Ask failed: ${e}`; } cx.notify(); });
  }

  // Every comment, with its lines, as one review message.
  submit(cx) {
    if (!this.comments.length || !this.root) return;
    const list = [...this.comments].sort((a, b) => a.path.localeCompare(b.path) || (a.from?.number ?? -1) - (b.from?.number ?? -1));
    const parts = list.map((c) => {
      if (c.whole) return `### ${c.path}, whole file (${this.describe(c.path)})\n\nComment: ${c.text}`;
      let body;
      if (c.path === this.open) {
        const from = this.at(c.from), to = this.at(c.to);
        body = from >= 0 && to >= from ? this.quote(this.rows.slice(from, to + 1)) : null;
      }
      const span = c.from.number === c.to.number ? `line ${c.from.number}` : `lines ${c.from.number}-${c.to.number}`;
      // Lines gone from the diff: the ones captured when the comment was made.
      if (body === undefined || body === null) body = c.quote ?? (c.from.text === c.to.text ? `${String(c.from.number).padStart(5)} ${c.from.kind} ${c.from.text}` : `${String(c.from.number).padStart(5)} ${c.from.kind} ${c.from.text}\n      …\n${String(c.to.number).padStart(5)} ${c.to.kind} ${c.to.text}`);
      return `### ${c.path}, ${span}\n${body}\n\nComment: ${c.text}`;
    });
    const n = list.length, title = `Review · ${n} comment${n > 1 ? "s" : ""}`;
    const context = `Code review of ${this.root}${this.on ? ` (on ${this.on})` : ""}: ${this.scopeWords()}. ${n} comment${n > 1 ? "s" : ""}. Line numbers are new-file numbers; "-" lines are removed.\n\n${parts.join("\n\n")}`;
    this.submitting = Date.now();
    cx.spawn(async (cx) => {
      try { const r = await ask({ title, context, sent: SENT }); if (r === "sent") this.setComments([], cx); else if (r === "none") this.submitting = null; }
      catch (e) { this.note_ = `Submit failed: ${e}`; this.submitting = null; }
      cx.notify();
    });
  }

  commit(cx) {
    if (!this.message.trim() || !this.root || this.busy || this.loading || this.context !== key()) return;
    const root = this.root, on = this.on, context = this.context, message = this.message.trim();
    this.busy = true; this.note_ = null;
    cx.spawn(async (cx) => {
      try {
        for (const args of [["add", "-A"], ["commit", "-m", message]]) {
          const r = await exec("git", args, { cwd: root, on });
          if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        }
        if (key() === context) { this.message = ""; this.input.set_value(""); }
      } catch (e) { if (key() === context) this.note_ = `Commit failed: ${e}`; }
      finally { this.busy = false; this.refresh(cx); cx.notify(); }
    });
    cx.notify();
  }

  // The scope picker: a small select-looking box with the scope's name; a
  // Popover lists the scopes the repo offers, with a check on the current one.
  scopePicker(t) {
    const i = this.scopeInfo ?? {};
    const options = [
      { scope: "work", label: "Uncommitted", detail: "working tree vs HEAD", ok: true },
      { scope: "last", label: "Last commit", detail: i.last ? `${i.last}${i.subject ? ` · ${i.subject}` : ""}, plus uncommitted` : "HEAD has no parent", ok: Boolean(i.last) },
      { scope: "branch", label: i.base ? `vs ${i.base}` : "vs base branch", detail: i.merge ? `everything on ${i.branch} since it left ${i.base}` : i.base ? `on ${i.base} itself` : "no main or master branch", ok: Boolean(i.merge) },
    ];
    const box = h_flex().id("scope-box").h(24).px(8).gap(6).items_center().rounded(6).border_1().border_color(this.choosingScope ? t.accent : t.border).bg(t.raised).cursor_pointer().hover((s) => s.bg(t.hover))
      .tooltip("What is reviewed: the uncommitted changes, the last commit, the whole branch, or one commit").child(div().text_size(12).child(this.scopeLabel())).child(svg("mods/my-review/chevron-down.svg").size(11).text_color(t.dim));
    const check = (on) => on ? svg("mods/my-review/check.svg").size(12).text_color(t.accent) : div().w(12);
    // The recent commits, newest first: a click reviews that commit on its own.
    const commits = (this.log ?? []).map((c) =>
      h_flex().id(`scope-commit-${c.sha}`).px(10).py(5).gap(8).items_center().rounded(6).cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.setScope("commit", cx, c.sha)).tooltip(`${c.short} · ${c.author} · ${c.when}\n${c.subject}`)
        .child(div().flex_none().text_size(11).font_family(codeFont()).text_color(t.dim).child(c.short))
        .child(div().flex_1().min_w(0).text_size(12).truncate().child(c.subject))
        .child(div().flex_none().text_size(10).text_color(t.muted).child(c.when))
        .child(check(this.scope === "commit" && this.sha === c.sha)));
    return Popover.new("scope").open(this.choosingScope).on_open_change((open, cx) => { this.choosingScope = open; if (open) this.loadLog(cx); cx.notify(); })
      .trigger(box)
      .content(v_flex().mt(4).min_w(300).max_w(420).p(6).gap(2).rounded(8).border_1().border_color(t.border).bg(t.popover).shadow_md().children(options.map((o) =>
        h_flex().id(`scope-${o.scope}`).px(10).py(7).gap(10).items_center().rounded(6).when(o.ok, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.setScope(o.scope, cx))).when(!o.ok, (e) => e.opacity(0.5))
          .child(v_flex().flex_1().min_w(0).gap(2).child(div().text_size(12).child(o.label)).child(div().text_size(11).text_color(t.dim).truncate().child(o.detail)))
          .child(check(o.scope === this.scope))))
        .child(div().mt(4).mx(4).border_t(1).border_color(t.border))
        .child(div().px(10).pt(6).pb(2).text_size(11).text_color(t.dim).truncate().child(i.merge ? `One commit on ${i.branch}, on its own` : "One commit, on its own"))
        .child(v_flex().id("scope-commits").max_h(280).overflow_y_scrollbar().gap(1)
          .when(this.log === null, (e) => e.child(div().px(10).py(5).text_size(11).text_color(t.dim).child("Loading commits…")))
          .when(this.log !== null && !commits.length, (e) => e.child(div().px(10).py(5).text_size(11).text_color(t.dim).child("No commits")))
          .children(commits)));
  }

  // A panel under 600px has no room for a column beside the diff.
  narrow() { return (this.size?.width ?? 368) < 600; }

  // The comment box: title, the lines it is about, the textarea, Add / Cancel / Delete.
  // `docked`: a strip under the diff (narrow panel) instead of a 300px card over its top-right.
  box(t, target, docked) {
    const c = this.composer, editing = Boolean(c.editing);
    const where = c.whole ? `whole file (${this.describe(c.path)})` : target ? (target.from === target.to ? `line ${this.rows[target.from].number ?? ""}` : `lines ${this.rows[target.from].number}–${this.rows[target.to].number}`) : "those lines are no longer in the diff";
    const hint = [c.whole ? "Click a line to comment on lines instead." : editing ? "" : "Click a line to widen the range; click a highlighted line to clear it.", "Enter adds, shift-enter starts a new line, Esc cancels."].filter(Boolean).join("\n");
    // Every press inside the box stops here: the box floats over the list, and a click that
    // fell through to the row underneath would reopen the box the moment Add closed it.
    const stop = (action) => (e, cx) => { cx.stop_propagation(); action(e, cx); };
    const button = (id, label, primary, action, tip) => div().id(id).h(26).px(10).flex().items_center().rounded(6).bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground).text_size(11).font_medium().cursor_pointer().hover((s) => s.opacity(0.88)).on_click(stop(action)).tooltip(tip).child(label);
    const link = (id, label, color, action, tip) => div().id(id).h(26).px(7).flex().items_center().rounded(6).text_size(11).text_color(color).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(stop(action)).tooltip(tip).child(label);
    return v_flex().id("comment-box").flex_none().gap(8).p(10).text_size(12).when(docked, (e) => e.bg(t.surface))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_up("left", (_e, cx) => cx.stop_propagation()).on_click((_e, cx) => cx.stop_propagation())
      .when(!docked, (e) => e.absolute().top(12).right(14).w(300).rounded(10).border_1().border_color(t.border).bg(t.surface + "eb").shadow_lg())
      .when(docked, (e) => e.w_full().border_t(1).border_color(t.border))
      .child(h_flex().items_center().gap(6)
        .child(div().font_semibold().child(editing ? "Edit comment" : "Comment"))
        // The how-to lives on this "?": a tooltip on hover, and a click shows it in the box.
        .child(div().id("comment-help").size(16).flex().items_center().justify_center().rounded(8).border_1().border_color(this.help ? t.accent : t.border).text_size(10).text_color(this.help ? t.accent : t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground).border_color(t.foreground)).tooltip(hint)
          .on_click(stop((_e, cx) => { this.help = !this.help; cx.notify(); })).child("?"))
        .child(div().flex_1())
        .child(div().id("comment-close").size(20).flex().items_center().justify_center().rounded(5).cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(stop((_e, cx) => this.closeComposer(cx))).tooltip("Close (Esc)").child("×")))
      .child(div().text_size(11).text_color(t.dim).whitespace_normal().child(`${c.path.split("/").pop()} · ${where}`))
      .when(Boolean(this.help), (e) => e.child(v_flex().gap(2).px(8).py(6).rounded(6).bg(t.raised).text_size(10.5).text_color(t.dim).children(hint.split("\n").map((l) => div().whitespace_normal().child(l)))))
      .child(div().w_full().child(Textarea.new(this.note).w_full().px(8).py(6).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(12).text_color(t.foreground)))
      .child(h_flex().items_center().gap(6).flex_wrap()
        .child(button("comment-add", editing ? "Save" : "Add comment", true, (_e, cx) => this.addComment(cx), "Enter"))
        .child(link("comment-cancel", "Cancel", t.dim, (_e, cx) => this.closeComposer(cx), "Esc"))
        .when(editing, (e) => e.child(div().flex_1()).child(link("comment-delete", "Delete", t.ansi1, (_e, cx) => this.deleteComment(cx), "Remove this comment from the review"))));
  }

  item(it, t, colors, target, commented) {
    const width = (this.size?.width ?? 368) - 60;
    if (it.kind === "comment") {
      const span = it.whole ? "whole file" : it.from === it.to ? `line ${this.rows[it.from].number}` : `lines ${this.rows[it.from].number}–${this.rows[it.to].number}`;
      return div().w_full().h(it.height).flex_none().pl(42).pr(12).py(4).cursor_pointer()
        .child(v_flex().max_w(width).rounded(8).border_1().border_color(it.live ? t.accent : t.accent + "66").bg(t.surface).px(10).py(6).gap(3)
          .child(div().text_size(10).text_color(it.live ? t.accent : t.dim).child(it.live ? `Comment · ${span} · editing` : `Comment · ${span} · click to edit`))
          .child(div().text_size(this.fontSize).whitespace_normal().text_color(it.text ? t.foreground : t.dim).child(it.text || "(empty)")));
    }
    if (it.kind === "fold") {
      return h_flex().w_full().h(this.row).flex_none().items_center().cursor_pointer().bg(t.raised + "80").text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .child(div().w(this.gutter + 16).flex_none().text_center().child("⋯"))
        .child(div().flex_1().min_w(0).truncate().text_size(this.fontSize - 1).child(`${it.count} unchanged line${it.count > 1 ? "s" : ""} · click to show`));
    }
    const { kind, number, spans } = this.rows[it.i], i = it.i;
    const on = target && i >= target.from && i <= target.to, mark = commented.has(i);
    if (kind === "@") {
      return h_flex().w_full().h(this.row).flex_none().items_center().cursor_pointer().bg(t.raised).border_l(2).border_color(on ? t.accent : NONE)
        .child(div().w(this.gutter + 16).flex_none()).child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(spans[0].text));
    }
    // Added and removed rows get a clear tint (stronger when targeted), a
    // colored sign column and a tinted gutter, like a GitHub diff.
    const tint = kind === "+" ? colors.added : kind === "-" ? colors.removed : null;
    return h_flex().w_full().h(this.row).flex_none().cursor_pointer().border_l(2).border_color(on ? t.accent : mark ? t.accent + "66" : NONE)
      .when(Boolean(tint), (e) => e.bg(tint + (on ? "5c" : "30")))
      .when(!tint && on, (e) => e.bg(t.selected))
      .child(div().w(this.gutter).flex_none().text_right().pr(4).when(Boolean(tint), (e) => e.bg(tint + "26")).text_color(on ? t.foreground : tint ? t.foreground + "cc" : t.dim).child(number === undefined ? "" : String(number)))
      .child(div().w(16).flex_none().text_center().font_bold().text_color(tint ?? NONE).child(kind === "+" ? "+" : kind === "-" ? "−" : " "))
      .child(h_flex().flex_1().min_w(0).overflow_hidden().child(h_flex().flex_none().ml(-(this.scrollX ?? 0)).whitespace_nowrap().children(spans.map((s) => s.cls ? div().text_color(colors[s.cls] ?? t.foreground).child(s.text) : div().child(s.text)))));
  }

  render(cx) {
    if (this.dialog) return this.dialog.render(cx);
    const request = shared(OPEN);
    if (request != null && this.stale(request)) cx.timer.after(1, () => setShared(OPEN, null));
    else if (key() !== this.context || (request?.id !== this.tried && this.requestedFile(request) !== null)) this.refresh(cx);
    const size = codeSize();
    if (size !== this.fontSize) { this.fontSize = size; this.row = rowOf(size); for (const p of new Set([...this.views.keys(), this.open].filter(Boolean))) this.withView(p, () => this.measure()); }
    // "Full file" may have been switched in another copy of the panel.
    else if (this.full() !== this.builtFull) this.rebuild();
    // The dialog reports a sent review through a shared key; the draft goes.
    const sentAt = shared(SENT);
    if (this.submitting && typeof sentAt === "number" && sentAt >= this.submitting) { this.submitting = null; cx.timer.after(1, (cx) => this.setComments([], cx)); }
    const t = theme(), colors = palette(props()?.palette, t), add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const enabled = Boolean(this.message.trim() && this.root && !this.busy && !this.loading);
    const target = this.target(), n = this.comments.length, canAsk = Boolean(this.open && this.rows.length);
    const commented = new Set();
    for (const it of this.items) if (it.kind === "comment") for (let j = it.from; j <= it.to; j++) commented.add(j);
    const perFile = {};
    for (const c of this.comments) perFile[c.path] = (perFile[c.path] ?? 0) + 1;
    // The current file, for the rows and cards (drawing a card swaps this.open for a moment).
    const focus = this.open; this.focus = focus;
    const button = (id, label, primary, action) => div().id(id).h(24).px(10).flex().items_center().rounded(6).bg(primary ? t.solid : t.raised).text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium().cursor_pointer().hover((s) => s.opacity(0.88)).on_click(action).child(label);
    const link = (id, label, action) => div().id(id).h(24).px(8).flex().items_center().rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(action).child(label);
    return v_flex().id("changes").size_full().min_h(0).relative().rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_size_change((size, cx) => { const w = this.size?.width; this.size = size; if (w !== size.width) { this.rebuild(); cx.notify(); } })
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
        else if (e.key === "escape" && this.composer) { this.closeComposer(cx); cx.stop_propagation(); }
        else if (e.key === "enter" && (e.modifiers?.platform || e.modifiers?.control) && this.composer) { this.addComment(cx); cx.stop_propagation(); }
        // Moving through the files (viewed.js): j/k next and previous, v viewed. Not while typing.
        else if (!this.typing && !this.composer && !e.modifiers?.platform && !e.modifiers?.control && !e.modifiers?.alt && ["j", "k", "v", "e"].includes(e.key)) {
          if (e.key === "e") this.editFile(this.open, cx);
          else if (e.key === "v") { if (this.open) this.toggleViewed(this.open, cx); } else this.step(e.key === "j" ? 1 : -1, cx);
          cx.stop_propagation();
        }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(div().h(24).px(8).flex().items_center().rounded(6).border_1().border_color(t.border).text_size(12).text_color(t.muted).child(`${this.files.length} files`))
        .when(this.files.length > 0, (e) => e.child(div().text_size(12).text_color(t.dim).child(`${this.files.filter((f) => this.viewedState(f.path) === "viewed").length}/${this.files.length} viewed`)))
        .when(Boolean(this.root) && this.hasHead, (e) => e.child(this.scopePicker(t)))
        .child(div().flex_1())
        // Full file: the icon shows what a click does (unfold when folded, fold when the whole file shows).
        .when(this.gaps?.length > 0, (e) => e.child(div().id("full-file").size(24).flex().items_center().justify_center().rounded(6).border_1().border_color(this.full() ? t.accent : t.border).bg(this.full() ? t.accent + "22" : NONE).text_color(this.full() ? t.accent : t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip(this.full() ? "Fold the unchanged lines" : "Show the whole file").on_click((_e, cx) => this.toggleFull(cx))
          .child(svg(this.full() ? "mods/my-review/fold-vertical.svg" : "mods/my-review/unfold-vertical.svg").size(13))))
        .child(div().text_size(11).text_color(t.ansi2).child(`+${add}`)).child(div().text_size(11).text_color(t.ansi1).child(`−${del}`))
        .when(n > 0, (e) => e.child(link("review-discard", "Discard", (_e, cx) => this.setComments([], cx))).child(button("review-submit", `Submit review · ${n}`, true, (_e, cx) => this.submit(cx))))
        .when(n === 0 && canAsk, (e) => e.child(button("ask", "Ask about diff", false, (_e, cx) => this.askAbout(null, cx)))))
      // One scroll position for every file: expanded ones as cards, the rest as rows.
      .child(this.viewport(t, colors, perFile, n, focus, div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : !this.root ? "No folder" : this.scope === "work" ? "No uncommitted changes" : "No changes in this scope"))))
      .when(this.limited, el => el.child(div().px(12).py(4).text_size(11).text_color(t.dim).child("Showing the first 1,000 changed files")))
      // Narrow panel: the comment box is a strip under the diff instead of a column beside it.
      .when(Boolean(this.composer) && this.narrow(), (e) => e.child(this.box(t, target, true)))
      .when(Boolean(this.note_), (e) => e.child(div().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note_)))
      .child(h_flex().flex_none().p(10).gap(8).border_t(1).border_color(t.border)
        .child(div().id("commit-message").flex_1().min_w(0).h(32).px(10).flex().items_center().rounded(8).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)))
        .child(div().id("commit").h(32).px(14).flex().items_center().rounded(8).bg(enabled ? t.solid : t.raised).text_color(enabled ? t.solid_foreground : t.dim).text_size(12).when(enabled, (e) => e.cursor_pointer()).on_click((_e, cx) => this.commit(cx)).child(this.busy ? "Committing…" : "Commit")));
  }

  // A click on a file's row: expand or collapse it, and make it current.
  pick(path, cx) {
    const open = !this.isExpanded(path);
    if (!open) this.keepPlace(path);
    this.toggled.set(path, open); this.note_ = null;
    this.focusFile(path);
    if (open) this.ensureLoaded(path, cx);
    cx.notify();
  }
}
