// Viewed marks, like a GitHub review's "Viewed" box (added to reviewer in this
// dotfiles copy; not upstream). Each mark is saved with a fingerprint of that
// file's diff in that scope, so when the diff changes the mark no longer
// matches: the file shows unchecked again, flagged as changed since viewed.
//
// A fingerprint is the file's status, its blob on the base side and its blob on
// the reviewed side (`git diff --raw`), with working-tree files hashed by
// `git hash-object --no-filters`: two git runs for the whole list, and the same
// diff always gives the same fingerprint.
//
// Marks live in <app home>/data/reviewer/viewed.json:
//   { "<machine>:<repo>:<scope id>": { "<path>": "<fingerprint>" } }
// The reviewer-viewed command (dotfiles) reads and writes the same file, for agents.
import { appHome, readTextFile, writeTextFile } from "herdr";
import * as fs from "fs/promises";

const ZERO = /^0+$/;
const folder = () => `${appHome()}/data/reviewer`;
const file = () => `${folder()}/viewed.json`;

// path -> fingerprint, for the files in the list. `git` runs git in the repo.
export async function fingerprints(git, { range, scope, hasHead, files }) {
  const prints = {}, base = {}, side = {};
  if (hasHead) {
    const raw = await git(["diff", ...range, "--raw", "-z", "--no-renames", "--abbrev=40", "--no-ext-diff"]);
    if (raw.code === 0) {
      // ":<mode> <mode> <old sha> <new sha> <status>\0<path>\0" per file.
      const parts = raw.stdout.split("\0");
      for (let i = 0; i + 1 < parts.length; i += 2) {
        const meta = parts[i].split(" ");
        if (meta.length < 5) continue;
        base[parts[i + 1]] = meta[2];
        if (!ZERO.test(meta[3])) side[parts[i + 1]] = meta[3];
      }
    }
  }
  // Working-tree content (scopes that include uncommitted changes): hashed here.
  const loose = scope === "commit" ? [] : files.filter((f) => f.status !== "D" && !side[f.path]).map((f) => f.path);
  for (let i = 0; i < loose.length; i += 200) {
    const chunk = loose.slice(i, i + 200);
    const r = await git(["hash-object", "--no-filters", "--", ...chunk]);
    if (r.code !== 0) continue;
    r.stdout.trim().split("\n").forEach((sha, j) => { if (sha) side[chunk[j]] = sha; });
  }
  for (const f of files) prints[f.path] = `${f.status}:${base[f.path] ?? "-"}:${f.status === "D" ? "-" : side[f.path] ?? "?"}`;
  return prints;
}

async function read() {
  const text = await readTextFile(file()).catch(() => null);
  try { return { text, marks: JSON.parse(text ?? "{}") ?? {} }; } catch { return { text, marks: {} }; }
}

// The marks of one scope: path -> fingerprint.
export async function loadMarks(key) {
  return (await read()).marks[key] ?? {};
}

// Marks `path` viewed with `print`, or clears it (print null). Only the files
// still in the list keep their marks, so finished work doesn't pile up.
export async function saveMark(key, path, print, listed) {
  await fs.mkdir(folder(), { recursive: true }).catch(() => {});
  for (let tries = 0; tries < 3; tries++) {
    const { text, marks } = await read();
    const scope = Object.fromEntries(Object.entries(marks[key] ?? {}).filter(([p]) => listed.has(p)));
    if (print) scope[path] = print; else delete scope[path];
    if (Object.keys(scope).length) marks[key] = scope; else delete marks[key];
    try {
      await writeTextFile(file(), JSON.stringify(marks, null, 2) + "\n", text);
      return scope;
    } catch { /* another window wrote meanwhile: read again */ }
  }
  throw new Error("couldn't save the viewed mark");
}
