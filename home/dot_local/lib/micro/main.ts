import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
const config = join(homedir(), '.config/herdr/micro');
const key = createHash('sha256').update(process.env.HERDR_SOCKET_PATH || 'default').digest('hex').slice(0, 16);
const directory = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'micro', key);
const statePath = join(directory, 'state.json');
const contextPath = join(directory, 'context.json');
const read = (path: string) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; } };
const save = (path: string, value: unknown) => {
  writeFileSync(path + '.tmp', JSON.stringify(value), { mode: 0o600 });
  renameSync(path + '.tmp', path);
};
function query(...args: string[]) {
  const result = spawnSync(herdr, args, { encoding: 'utf8', timeout: 45000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Herdr command failed');
  return JSON.parse(result.stdout).result;
}
async function main() {
  if (process.env.HERDR_ENV !== '1' && !process.env.HERDR_ACTIVE_PANE_ID) throw new Error('Run micro inside Herdr');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockPath = join(directory, 'launch.lock');
  try { mkdirSync(lockPath); }
  catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
    const owner = read(join(lockPath, 'owner.json')).pid;
    if (!owner) throw new Error('micro is starting; if interrupted, remove ' + lockPath);
    try { process.kill(owner, 0); return; } catch {}
    rmSync(lockPath, { recursive: true });
    mkdirSync(lockPath);
  }
  save(join(lockPath, 'owner.json'), { pid: process.pid });
  try {
    const state = read(statePath);
    let agent;
    try { agent = query('agent', 'get', 'micro').agent; } catch {}
    if (agent && agent.cwd !== config) throw new Error('An agent named micro already exists outside the micro directory');
    if (agent) {
      state.pane = agent.pane_id;
      state.session = agent.agent_session?.value || state.session;
      save(statePath, state);
    }
    const source = process.env.HERDR_ACTIVE_PANE_ID || process.env.HERDR_PANE_ID;
    const caller = query('pane', 'get', source!).pane;
    if (caller.pane_id !== agent?.pane_id) save(contextPath, { capturedAt: new Date().toISOString(), pane: caller.pane_id,
      workspace: caller.workspace_id, cwd: caller.foreground_cwd || caller.cwd });
    if (!agent) {
      let pane;
      if (state.pane) {
        try { pane = query('pane', 'get', state.pane).pane; } catch {}
        if (pane && (pane.agent || pane.cwd !== config)) throw new Error('micro’s saved pane has another occupant');
      }
      if (!pane) pane = query('workspace', 'create', '--cwd', config, '--label', 'micro',
        '--env', `MICRO_CONTEXT_FILE=${contextPath}`, '--no-focus').root_pane;
      save(statePath, { ...state, pane: pane.pane_id, view: undefined });
      const args = state.session ? ['resume', state.session] : [];
      query('agent', 'start', 'micro', '--kind', 'codex', '--pane', pane.pane_id, '--', ...args);
      agent = query('agent', 'get', 'micro').agent;
    }
    save(statePath, { pane: agent.pane_id, session: agent.agent_session?.value || state.session });
    query('tab', 'rename', agent.tab_id, '🤖 micro');
    query('pane', 'rename', agent.pane_id, 'micro');
    query('agent', 'focus', 'micro');
  } finally { rmSync(lockPath, { recursive: true, force: true }); }
}
main().catch(error => {
  console.error(String(error));
  try { query('notification', 'show', 'micro', '--body', String(error)); } catch {}
  process.exitCode = 1;
});
