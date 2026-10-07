import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { captureSession } from './session';
import { moveWorkspaceFirst } from './workspace';
import { findMicroAgent } from './agent';

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
    let agent = findMicroAgent(query, state, config);
    let resumedSession: string | undefined;
    if (agent) {
      state.pane = agent.pane_id;
      state.session = agent.agent_session?.value;
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
      resumedSession = state.session;
      // Keep coordination responsive without changing other agents' defaults.
      args.push('--model', 'gpt-5.6-terra', '-c', 'model_reasoning_effort="low"');
      // Explicitly requested for micro only; other agents keep their defaults.
      args.push('--dangerously-bypass-approvals-and-sandbox');
      query('agent', 'start', 'micro', '--kind', 'codex', '--pane', pane.pane_id, '--', ...args);
      agent = query('agent', 'get', pane.pane_id).agent;
    }
    // Readiness can precede the integration's session report. Never associate
    // an old conversation ID with a newly detected agent.
    save(statePath, { pane: agent.pane_id, session: agent.agent_session?.value || resumedSession });
    query('tab', 'rename', agent.tab_id, '🤖 micro');
    query('pane', 'rename', agent.pane_id, 'micro');
    // Restore the first position on every launch; Herdr persists workspace order.
    await moveWorkspaceFirst(process.env.HERDR_SOCKET_PATH || join(homedir(), '.config/herdr/herdr.sock'), agent.workspace_id);
    query('agent', 'focus', agent.pane_id);
    // A resume ID explicitly passed above is known even before the first hook
    // report. Never use a previous ID for an independently started agent.
    const session = agent.agent_session?.value || resumedSession
      || await captureSession(agent, () => query('agent', 'get', agent.pane_id).agent);
    save(statePath, { pane: agent.pane_id, session });
  } finally { rmSync(lockPath, { recursive: true, force: true }); }
}
main().catch(error => {
  console.error(String(error));
  try { query('notification', 'show', 'micro', '--body', String(error)); } catch {}
  process.exitCode = 1;
});
