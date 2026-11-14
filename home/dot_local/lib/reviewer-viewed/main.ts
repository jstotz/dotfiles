// Reads and sets the Herdr reviewer mod's Viewed marks from the command line, so
// agents can mark files viewed. It lists a scope's changed files and computes
// each one's diff fingerprint exactly as the mod does (mods/reviewer/viewed.js),
// then writes the same file the mod reads: <app home>/data/reviewer/viewed.json,
// keyed "<machine>:<repo>:<scope>" (machine empty: this computer).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export type File = { path: string; status: string };
export type Marks = Record<string, Record<string, string>>;

const USAGE = `usage: reviewer-viewed [--repo DIR] [--scope SCOPE] <command>

  list [--json]              the scope's files: viewed, changed or unviewed
  mark <glob>... | --all     mark matching files viewed
  unmark <glob>... | --all   clear their marks

SCOPE is what the reviewer panel's scope picker shows: work (uncommitted
changes, the default), last (the last commit plus them), branch (everything
since the branch left its base), or commit:<sha>. Globs match paths relative
to the repository root ("src/**/*.test.ts"); a folder matches what's under it.`;

const ZERO = /^0+$/;
const READ = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'diff.autoRefreshIndex=false'];
const marksFile = () => join(process.env.HERDR_APP_HOME || join(homedir(), '.config/herdr-app'), 'data/reviewer/viewed.json');

// `git diff --raw -z`: path -> base blob, and path -> reviewed blob when committed.
export function parseRaw(stdout: string) {
  const base: Record<string, string> = {}, side: Record<string, string> = {};
  const parts = stdout.split('\0');
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const meta = parts[i].split(' ');
    if (meta.length < 5) continue;
    base[parts[i + 1]] = meta[2];
    if (!ZERO.test(meta[3])) side[parts[i + 1]] = meta[3];
  }
  return { base, side };
}

// The reviewer's letter for a file: A for untracked, D/A/U as git says, else M.
export function statusOf(letter: string, fresh: boolean) {
  if (fresh) return 'A';
  return letter === 'D' || letter === 'A' || letter === 'U' ? letter : 'M';
}

export function fingerprint(f: File, base: Record<string, string>, side: Record<string, string>) {
  return `${f.status}:${base[f.path] ?? '-'}:${f.status === 'D' ? '-' : side[f.path] ?? '?'}`;
}

// Whether a repo-relative path matches any of the globs (a folder matches what's in it).
export function matches(path: string, globs: string[]) {
  return globs.some((g) => {
    const glob = g.replace(/^\.\//, '').replace(/\/$/, '');
    return new Bun.Glob(glob).match(path) || path.startsWith(glob + '/');
  });
}

// Sets (print) or clears (null) marks in one scope, keeping everything else.
export function applyMarks(marks: Marks, key: string, updates: Record<string, string | null>) {
  const scope = { ...(marks[key] ?? {}) };
  for (const [path, print] of Object.entries(updates)) {
    if (print) scope[path] = print; else delete scope[path];
  }
  const next = { ...marks };
  if (Object.keys(scope).length) next[key] = scope; else delete next[key];
  return next;
}

function git(cwd: string, args: string[], allowFail = false) {
  const r = spawnSync('git', [...READ, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (!allowFail && (r.error || r.status !== 0)) throw new Error(r.error?.message || r.stderr.trim() || `git ${args[0]} failed`);
  return r.status === 0 ? r.stdout : null;
}

// What a scope diffs, as the reviewer panel works it out.
function rangeOf(root: string, scope: string): string[] {
  if (scope === 'work') return ['HEAD'];
  if (scope === 'last') {
    const last = git(root, ['rev-parse', '--short', 'HEAD']).trim();
    if (git(root, ['rev-parse', '--verify', '-q', 'HEAD~1'], true) === null) throw new Error('there is no last commit to review against');
    return [`${last}~1`];
  }
  if (scope === 'branch') {
    const head = (ref: string) => git(root, ['rev-parse', '--verify', '-q', ref], true) !== null;
    let base = git(root, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], true)?.trim().replace(/^refs\/remotes\/origin\//, '') || '';
    if (!base) base = ['main', 'master'].find((b) => head(`refs/heads/${b}`)) ?? '';
    if (!base) throw new Error('no base branch (origin/HEAD, main or master)');
    const merge = git(root, ['merge-base', head(`refs/heads/${base}`) ? base : `origin/${base}`, 'HEAD']).trim();
    return [merge];
  }
  if (scope.startsWith('commit:')) {
    const sha = git(root, ['rev-parse', '--verify', '-q', `${scope.slice(7)}^{commit}`]).trim();
    const parent = git(root, ['rev-parse', '--verify', '-q', `${sha}~1`], true)?.trim() || git(root, ['hash-object', '-t', 'tree', '/dev/null']).trim();
    return [parent, sha];
  }
  throw new Error(`unknown scope ${scope}\n\n${USAGE}`);
}

export function scopeId(root: string, scope: string) {
  if (!scope.startsWith('commit:')) return scope;
  return `commit:${git(root, ['rev-parse', '--verify', '-q', `${scope.slice(7)}^{commit}`]).trim()}`;
}

// The scope's files and their fingerprints.
function filesOf(root: string, scope: string) {
  if (git(root, ['rev-parse', '--verify', 'HEAD'], true) === null) throw new Error('the repository has no commits yet');
  const range = rangeOf(root, scope);
  const stats = new Set(git(root, ['diff', ...range, '--numstat', '-z', '--no-renames']).split('\0').map((e) => e.split('\t').slice(2).join('\t')).filter(Boolean));
  const changed = new Map<string, string>();
  const names = git(root, ['diff', ...range, '--name-status', '-z', '--no-renames']).split('\0');
  for (let i = 0; i + 1 < names.length && names[i]; i += 2) if (names[i][0] !== 'M' || stats.has(names[i + 1])) changed.set(names[i + 1], names[i][0]);
  if (scope !== 'commit' && !scope.startsWith('commit:')) {
    for (const entry of git(root, ['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all']).split('\0').filter(Boolean)) {
      const xy = entry.slice(0, 2), path = entry.slice(3);
      if (xy === '??') changed.set(path, '?');
      else if (xy.includes('U') || xy === 'AA' || xy === 'DD') changed.set(path, 'U');
    }
  }
  const files: File[] = [...changed.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 1000)
    .map(([path, letter]) => ({ path, status: statusOf(letter, letter === '?') }));
  const { base, side } = parseRaw(git(root, ['diff', ...range, '--raw', '-z', '--no-renames', '--abbrev=40', '--no-ext-diff']));
  const loose = scope.startsWith('commit:') ? [] : files.filter((f) => f.status !== 'D' && !side[f.path]).map((f) => f.path);
  for (let i = 0; i < loose.length; i += 200) {
    const chunk = loose.slice(i, i + 200);
    git(root, ['hash-object', '--no-filters', '--', ...chunk]).trim().split('\n').forEach((sha, j) => { if (sha) side[chunk[j]] = sha; });
  }
  return files.map((f) => ({ ...f, print: fingerprint(f, base, side) }));
}

function readMarks(): Marks {
  try { return JSON.parse(readFileSync(marksFile(), 'utf8')) ?? {}; } catch { return {}; }
}

// Atomic, like the mod's own writes; the mod rereads on its next refresh.
function writeMarks(marks: Marks) {
  const path = marksFile();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify(marks, null, 2) + '\n');
  renameSync(path + '.tmp', path);
}

export function main(argv: string[]) {
  let repo = process.cwd(), scope = 'work';
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') repo = argv[++i] ?? '';
    else if (argv[i] === '--scope') scope = argv[++i] ?? '';
    else args.push(argv[i]);
  }
  const [command, ...rest] = args;
  if (!command || !['list', 'mark', 'unmark'].includes(command)) throw new Error(USAGE);
  const root = git(resolve(repo), ['rev-parse', '--show-toplevel']).trim();
  const key = `:${root}:${scopeId(root, scope)}`;
  const files = filesOf(root, scope);
  const marks = readMarks();
  const state = (f: { path: string; print: string }) => !marks[key]?.[f.path] ? 'unviewed' : marks[key][f.path] === f.print ? 'viewed' : 'changed';
  if (command === 'list') {
    if (rest[0] === '--json') return console.log(JSON.stringify(files.map((f) => ({ path: f.path, status: f.status, state: state(f) })), null, 2));
    for (const f of files) console.log(`${state(f).padEnd(8)}  ${f.status}  ${f.path}`);
    return;
  }
  const all = rest.includes('--all'), globs = rest.filter((r) => r !== '--all');
  if (!all && !globs.length) throw new Error(USAGE);
  const picked = files.filter((f) => all || matches(f.path, globs));
  if (!picked.length) throw new Error(`no changed files in ${scope} match ${globs.join(' ')}`);
  writeMarks(applyMarks(marks, key, Object.fromEntries(picked.map((f) => [f.path, command === 'mark' ? f.print : null]))));
  console.log(`${command === 'mark' ? 'marked viewed' : 'unmarked'}: ${picked.length} of ${files.length} files`);
  for (const f of picked) console.log(`  ${f.path}`);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
