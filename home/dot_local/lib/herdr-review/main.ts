import { reviewDifit } from './difit';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, openSync, closeSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
const root = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'herdr-review');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
function save(path: string, value: unknown) {
  writeFileSync(path + '.tmp', JSON.stringify(value), { mode: 0o600 });
  renameSync(path + '.tmp', path);
}
function command(bin: string, args: string[], options: any = {}): string {
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 10000, ...options });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${bin} failed`);
  return result.stdout.trim();
}
const query = (...args: string[]) => JSON.parse(command(herdr, args)).result;
function notify(message: string) {
  console.error(message);
  try { command(herdr, ['notification', 'show', 'Code review', '--body', message]); } catch {}
}
function identity(pane: any) {
  return JSON.stringify([pane.agent, pane.agent_session, pane.terminal_id]);
}
function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function focus(directory: string) {
  try { query('plugin', 'pane', 'focus', read(join(directory, 'handle.json')).paneId); }
  catch { console.log('Review is already starting or finishing.'); }
}

async function worker(directory: string) {
  const statePath = join(directory, 'state.json');
  const state = read(statePath);
  let failure: unknown;
  try {
    await reviewDifit(state, directory, query, command, (feedback) => {
      writeFileSync(join(directory, 'feedback.md'), feedback, { mode: 0o600 });
      const target = query('pane', 'get', state.pane).pane;
      if (identity(target) !== state.identity) throw new Error('The original agent has changed; feedback was not sent');
      command(herdr, ['agent', 'prompt', state.pane, feedback]);
      rmSync(join(directory, 'feedback.md'));
    });
  } catch (error) { failure = error; }
  finally {
    save(statePath, { ...state, status: failure ? 'failed' : 'complete', error: failure ? String(failure) : undefined });
    rmSync(join(directory, 'active'), { recursive: true, force: true });
  }
  if (failure) notify(`${failure}. Review files: ${directory}`);
}

function launch() {
  if (process.env.HERDR_ENV !== '1' && !process.env.HERDR_ACTIVE_PANE_ID) throw new Error('Run inside Herdr');
  const source = process.env.HERDR_ACTIVE_PANE_ID || process.env.HERDR_PANE_ID;
  if (!source) throw new Error('Herdr did not identify the calling pane');
  let pane = query('pane', 'get', source).pane;
  mkdirSync(root, { recursive: true, mode: 0o700 });
  // Pressing the shortcut inside our browser should refocus its existing review.
  if (!pane.agent) {
    for (const entry of readdirSync(root)) {
      const existing = join(root, entry);
      try {
        const state = read(join(existing, 'state.json'));
        if (alive(state.pid) && read(join(existing, 'handle.json')).paneId === source) {
          focus(existing); return;
        }
      } catch {}
    }
    throw new Error('Focus the agent you want to receive feedback, then open review');
  }
  const repo = command('git', ['-C', pane.foreground_cwd || pane.cwd, 'rev-parse', '--show-toplevel']);
  const key = createHash('sha256').update(JSON.stringify(['difit', process.env.HERDR_SOCKET_PATH, repo])).digest('hex').slice(0, 24);
  const directory = join(root, key);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const statePath = join(directory, 'state.json');
  const lock = join(directory, 'active');
  try { mkdirSync(lock); }
  catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    if (!existsSync(statePath) || alive(read(statePath).pid)) { focus(directory); return; }
    rmSync(lock, { recursive: true });
    mkdirSync(lock);
  }
  try {
    // Keep failed feedback before starting another attempt.
    if (existsSync(join(directory, 'feedback.md'))) {
      renameSync(join(directory, 'feedback.md'), join(directory, `feedback-${Date.now()}.md`));
    }
    rmSync(join(directory, 'handle.json'), { force: true });
    const state = { pid: process.pid, status: 'starting', pane: pane.pane_id, tab: pane.tab_id,
      workspace: pane.workspace_id, repo, identity: identity(pane) };
    save(statePath, state);
    const log = openSync(join(directory, 'launcher.log'), 'w', 0o600);
    const child = spawn(process.execPath, [import.meta.filename, '--worker', directory], {
      detached: true, stdio: ['ignore', log, log], env: process.env,
    });
    closeSync(log);
    if (!child.pid) throw new Error('Could not start review worker');
    save(statePath, { ...state, pid: child.pid, status: 'running' });
    child.unref();
    console.log(`Review opening for ${repo}; feedback will be submitted to ${pane.pane_id}.`);
  } catch (error) { rmSync(lock, { recursive: true, force: true }); throw error; }
}

if (process.argv[2] === '--worker') await worker(process.argv[3]);
else { try { launch(); } catch (error) { notify(String(error)); process.exitCode = 1; } }
