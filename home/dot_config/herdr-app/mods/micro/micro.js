// Starting, showing and hiding Micro's terminal (see main.js).
import { hc, exec, home, focused, spaces, run, notify, shared, setShared } from "herdr";

const NAME = "micro";
const RETURN = "micro.return";
const folder = () => `${home()}/.config/herdr/micro`;
const contextFile = () => `${home()}/.local/state/micro/app/context.json`;

async function terminal() {
  const r = await hc(["get", NAME, "--json"]);
  if (r.code !== 0) return null;
  const t = JSON.parse(r.stdout);
  return t.state === "live" ? t.address : null;
}

// Continue Micro's last conversation in its folder, else start one. When
// Claude exits the terminal ends, and the next summon starts it again.
async function start() {
  // Claude's own defaults: model, effort and permissions, as in any other session.
  const script = `export MICRO_CONTEXT_FILE='${contextFile()}'\nclaude --continue || exec claude`;
  const r = await hc(["run", "--bg", "--json", "--name", NAME, "--cwd", folder(), "--no-parent",
    "--label", "micro=1", "--", "/bin/zsh", "-lc", script]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || "hc run failed");
  return JSON.parse(r.stdout).address ?? (await terminal());
}

// Where the user was: Micro's "here". Written through a shell, since a mod's
// own file writes stay inside Herdr's folder.
async function recordContext(from) {
  if (!from?.space) return;
  const text = JSON.stringify({
    capturedAt: new Date().toISOString(),
    space: from.space,
    spaceName: spaces().find((s) => s.id === from.space)?.name ?? null,
    tab: from.tab,
    terminal: from.terminal,
    cwd: from.cwd,
  }, null, 2) + "\n";
  const r = await exec("/bin/sh", ["-c", 'mkdir -p "$(dirname "$1")" && printf %s "$2" > "$1.tmp" && mv "$1.tmp" "$1"', "sh", contextFile(), text]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "couldn't write the context file");
}

export async function toggle(cx) {
  const address = await terminal();
  if (address && focused()?.terminal === address) return hide();
  return show(cx);
}

// Peek at Micro over the current tab; peek gives it the keyboard.
export async function show() {
  const from = focused();
  let address = await terminal();
  if (address && from?.terminal === address) return;
  if (!address) {
    address = await start();
    notify({ title: "Micro is starting", body: "Continuing its last conversation.", level: "info", timeout: 3000 });
  }
  if (!address) throw new Error("Micro's terminal didn't start");
  await recordContext(from).catch((e) => console.warn(`micro context: ${e.message ?? e}`));
  setShared(RETURN, from?.terminal ?? null);
  run("terminal.peek", { terminal: address });
}

export function hide() {
  run("overlay.close", {});
  const back = shared(RETURN);
  if (back) run("pane.focus", { terminal: back });
}
