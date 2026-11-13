// Groups and nests Herdr desktop spaces for the my-sidebar mod, which watches the same
// file. A space is in at most one group, pinned spaces list first in their group, and
// a nested space shows beneath its parent instead of in its group.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Group = { name: string; spaces: string[]; pinned: string[] };
export type Parents = Record<string, string>;
type Space = { id: string; name: string };

export const DEFAULT_GROUP = 'default';
const USAGE = `usage: herdr-space-group <command>

  list [--json]                groups and their spaces
  set <space> <group>          move a space into a group (made if new)
  unset <space>                move a space back to ${DEFAULT_GROUP}
  pin <space> | unpin <space>
  rename <group> <new-name>    (onto an existing group: merges them)
  delete <group>               its spaces go back to ${DEFAULT_GROUP}
  set-parent <space> <parent>  show a space beneath another space
  remove-parent <space>

<space> is a space ID, its exact name, or "current" for the space this
terminal belongs to. Space IDs come from \`herdr-app ls\` or \`herdr-app do space.new\`.`;

const file = () => join(process.env.HERDR_APP_HOME || join(homedir(), '.config/herdr-app'), 'space-groups/groups.json');

export function parseFile(text: string | null): { groups: Group[]; parents: Parents } {
  let data: any = {};
  try {
    data = JSON.parse(text ?? '{}') ?? {};
  } catch {
    // A damaged file reads as empty.
  }
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .filter((g: any) => g && typeof g.name === 'string' && g.name)
    .map((g: any) => ({
      name: g.name,
      spaces: Array.isArray(g.spaces) ? g.spaces.filter((s: unknown) => typeof s === 'string') : [],
      pinned: Array.isArray(g.pinned) ? g.pinned.filter((s: unknown) => typeof s === 'string') : [],
    }));
  const parents: Parents = {};
  for (const [child, parent] of Object.entries(data.parents ?? {}))
    if (typeof parent === 'string' && parent !== child) parents[child] = parent;
  return { groups, parents };
}

export const parse = (text: string | null) => parseFile(text).groups;

// Whether `space` is `ancestor` or sits somewhere beneath it.
export function within(parents: Parents, space: string, ancestor: string) {
  const seen = new Set<string>();
  for (let at: string | undefined = space; at && !seen.has(at); at = parents[at]) {
    if (at === ancestor) return true;
    seen.add(at);
  }
  return false;
}

export function nest(parents: Parents, space: string, parent: string | null) {
  if (!parent) return void delete parents[space];
  if (within(parents, parent, space)) throw new Error("a space can't be its own parent or the parent of a space above it");
  parents[space] = parent;
}

export function assign(groups: Group[], space: string, name: string | null) {
  for (const g of groups) {
    g.spaces = g.spaces.filter((s) => s !== space);
    g.pinned = g.pinned.filter((s) => s !== space);
  }
  if (!name || name === DEFAULT_GROUP) return;
  let group = groups.find((g) => g.name === name);
  if (!group) groups.push((group = { name, spaces: [], pinned: [] }));
  group.spaces.push(space);
}

export function setPinned(groups: Group[], space: string, pinned: boolean) {
  const group = groups.find((g) => g.spaces.includes(space));
  if (!group) throw new Error('that space is in no group; set its group first');
  group.pinned = group.pinned.filter((s) => s !== space);
  if (pinned) group.pinned.push(space);
}

export function rename(groups: Group[], from: string, to: string) {
  const group = groups.find((g) => g.name === from);
  if (!group) throw new Error(`no group named ${from}`);
  if (!to || to === DEFAULT_GROUP) throw new Error(`"${DEFAULT_GROUP}" holds the ungrouped spaces; pick another name`);
  const into = groups.find((g) => g.name === to);
  if (!into) return void (group.name = to);
  into.spaces.push(...group.spaces.filter((s) => !into.spaces.includes(s)));
  into.pinned.push(...group.pinned.filter((s) => !into.pinned.includes(s)));
  groups.splice(groups.indexOf(group), 1);
}

export function remove(groups: Group[], name: string) {
  const at = groups.findIndex((g) => g.name === name);
  if (at < 0) throw new Error(`no group named ${name}`);
  groups.splice(at, 1);
}

function run(bin: string, args: string[]) {
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${bin} failed`);
  return result.stdout;
}

function liveSpaces(): Space[] {
  return JSON.parse(run('herdr-app', ['ls'])).spaces.map((s: Space) => ({ id: s.id, name: s.name }));
}

export function resolveSpace(arg: string, list: () => Space[], current: () => string): string {
  if (arg === 'current') return current();
  const spaces = list();
  if (spaces.some((s) => s.id === arg)) return arg;
  const named = spaces.filter((s) => s.name === arg);
  if (named.length === 1) return named[0].id;
  if (named.length > 1) throw new Error(`several spaces are named ${arg}: ${named.map((s) => s.id).join(', ')}`);
  throw new Error(`no space ${arg}; see herdr-app ls`);
}

function currentSpace() {
  const terminal = process.env.HC_TERMINAL_ID;
  if (!terminal) throw new Error('"current" works only in a Herdr desktop terminal ($HC_TERMINAL_ID)');
  const space = JSON.parse(run('hc', ['get', terminal, '--json'])).labels?.['herdr.space'];
  if (!space) throw new Error(`terminal ${terminal} belongs to no space`);
  return space;
}

// The sidebar writes with a compare-and-swap; write ours atomically beside it.
function write(groups: Group[], parents: Parents) {
  const path = file();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path + '.tmp', JSON.stringify({ groups, parents }, null, 2) + '\n');
  renameSync(path + '.tmp', path);
}

function load() {
  try {
    return parseFile(readFileSync(file(), 'utf8'));
  } catch {
    return { groups: [], parents: {} };
  }
}

export function main(argv: string[]) {
  const [command, ...args] = argv;
  const space = (arg?: string) => {
    if (!arg) throw new Error(USAGE);
    return resolveSpace(arg, liveSpaces, currentSpace);
  };
  const { groups, parents } = load();
  const save = (_groups: Group[]) => write(groups, parents);
  switch (command) {
    case 'list': {
      if (args[0] === '--json') return console.log(JSON.stringify({ groups, parents }, null, 2));
      const names = new Map(liveSpaces().map((s) => [s.id, s.name]));
      const name = (s: string) => names.get(s) ?? `(closed) ${s}`;
      const tree = (s: string, depth: number): string[] => [
        `${'  '.repeat(depth)}${name(s)}`,
        ...Object.keys(parents).filter((c) => parents[c] === s).flatMap((c) => tree(c, depth + 1)),
      ];
      for (const g of groups) {
        console.log(g.name);
        const order = [...g.pinned, ...g.spaces.filter((s) => !g.pinned.includes(s))];
        for (const s of order) if (!parents[s]) console.log(`  ${g.pinned.includes(s) ? '* ' : '  '}${tree(s, 0).join('\n      ')}`);
      }
      const roots = [...new Set(Object.values(parents))].filter((p) => !parents[p] && !groups.some((g) => g.spaces.includes(p)));
      if (roots.length) console.log('children outside groups');
      for (const p of roots) console.log(`    ${tree(p, 0).join('\n      ')}`);
      return;
    }
    case 'set-parent':
      if (!args[1]) throw new Error(USAGE);
      nest(parents, space(args[0]), space(args[1]));
      return save(groups);
    case 'remove-parent':
      nest(parents, space(args[0]), null);
      return save(groups);
    case 'set':
      if (!args[1]) throw new Error(USAGE);
      assign(groups, space(args[0]), args[1]);
      return save(groups);
    case 'unset':
      assign(groups, space(args[0]), null);
      return save(groups);
    case 'pin':
    case 'unpin':
      setPinned(groups, space(args[0]), command === 'pin');
      return save(groups);
    case 'rename':
      if (!args[1]) throw new Error(USAGE);
      rename(groups, args[0], args[1]);
      return save(groups);
    case 'delete':
      if (!args[0]) throw new Error(USAGE);
      remove(groups, args[0]);
      return save(groups);
    default:
      throw new Error(USAGE);
  }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
