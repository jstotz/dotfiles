// Archiving a worktree space. The space gets an "archive" tab running `wt archive`,
// then its other tabs close, ending their agents and terminals. The archive labels
// its terminal with how it went (Herdr keeps a shell in the tab either way): done,
// and the sidebar closes the space; failed, and the space stays with that shell to
// fix things in, no longer drawn as going away. Jobs live in shared state, so the confirm dialog
// can hand one to the sidebar, which starts and watches it.
import { shared, setShared, spaces, panes, run, exec, hc, notify } from "herdr";

const KEY = "my-sidebar.archiving";
const LABEL = "my-sidebar.archive";
const SCRIPT = [
  "wt archive --foreground",
  "rc=$?",
  `[ "$rc" -eq 0 ] && { hc label "$HC_TERMINAL_ID" ${LABEL}=done >/dev/null 2>&1; exit 0; }`,
  `hc label "$HC_TERMINAL_ID" ${LABEL}=failed >/dev/null 2>&1`,
  "printf '\\nwt archive failed (exit %s). Fix it here, then archive again or close the space.\\n' \"$rc\"",
  'exec "${SHELL:-/bin/zsh}" -l',
].join("\n");

export const archiving = () => shared(KEY) ?? {};
export const isArchiving = (id) => Boolean(archiving()[id]);

export function requestArchive(space, folder, name) {
  setShared(KEY, { ...archiving(), [space]: { folder, name, state: "queued" } });
}

function update(id, job) {
  const { [id]: _, ...rest } = archiving();
  setShared(KEY, job ? { ...rest, [id]: job } : rest);
}

const pause = () => exec("sleep", ["0.25"]).catch(() => {});

// The archive tab: the space's tab that wasn't there before.
const archiveTab = (space, job) => space.tabs.find((tab) => !job.before.includes(tab.id));

async function start(id, job) {
  const space = spaces().find((s) => s.id === id);
  if (!space) return update(id, null);
  const before = space.tabs.map((tab) => tab.id);
  update(id, { ...job, state: "running", before });
  run("tab.new", { space: id, name: "archive", folder: job.folder, argv: ["/bin/zsh", "-lc", SCRIPT] });
  // Close the rest once the archive tab holds the space open.
  for (let i = 0; i < 40; i++) {
    const now = spaces().find((s) => s.id === id);
    if (now && archiveTab(now, { before })) {
      for (const tab of before) run("tab.close", { id: tab, confirmed: true });
      return;
    }
    await pause();
  }
  notify({ title: `Couldn't archive ${job.name}`, body: "The archive tab didn't open.", level: "error" });
  update(id, null);
}

// Whether a running job is over: its space closed, or its terminal says how it went.
async function check(id, job) {
  const space = spaces().find((s) => s.id === id);
  if (!space) return update(id, null);
  const tab = archiveTab(space, job);
  const terminal = tab && panes().find((p) => p.tab === tab.id && p.terminal)?.terminal;
  if (!terminal) return;
  const got = await hc(["get", terminal, "--json"]).catch(() => null);
  const labels = got?.code === 0 ? (JSON.parse(got.stdout).labels ?? {}) : {};
  if (labels[LABEL] === "done") {
    // Choosing Archive already agreed to closing it.
    run("space.close", { id, confirmed: true });
    return update(id, null);
  }
  if (labels[LABEL] !== "failed") return;
  notify({ title: `Couldn't archive ${job.name}`, body: "Its archive tab says why.", level: "error" });
  update(id, null);
}

let busy = false;
let last = 0;

// The sidebar calls this on its timer.
export function runArchives(cx) {
  const jobs = Object.entries(archiving());
  if (!jobs.length || busy) return;
  const queued = jobs.filter(([, job]) => job.state === "queued");
  if (!queued.length && Date.now() - last < 1000) return;
  busy = true;
  last = Date.now();
  cx.spawn(async (cx) => {
    try {
      for (const [id, job] of jobs) await (job.state === "queued" ? start(id, job) : check(id, job));
    } catch (e) {
      console.warn(`my-sidebar archive: ${e.message ?? e}`);
    } finally {
      busy = false;
      cx.notify();
    }
  });
}
