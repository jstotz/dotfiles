import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
function command(bin: string, args: string[]): string {
  // The archive may remove the caller's directory. Run from a stable location;
  // wt -C explicitly selects the associated checkout, never the focused pane's cwd.
  const result = spawnSync(bin, args, { cwd: homedir(), encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || result.stdout || `${bin} failed`);
  }
  return result.stdout.trim();
}
const query = (...args: string[]) => JSON.parse(command(herdr, args)).result;

function archive() {
  if (process.env.HERDR_ENV !== '1') throw new Error('Run inside Herdr');
  const context = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || '{}');
  let workspaceId = context.workspace_id || process.env.HERDR_ACTIVE_WORKSPACE_ID;
  if (!workspaceId) {
    const paneId = process.env.HERDR_ACTIVE_PANE_ID || process.env.HERDR_PANE_ID;
    if (!paneId) throw new Error('Herdr did not identify the workspace to archive');
    workspaceId = query('pane', 'get', paneId).pane.workspace_id;
  }
  const workspace = query('workspace', 'get', workspaceId).workspace;
  const worktree = workspace.worktree;
  if (worktree?.is_linked_worktree) {
    if (!worktree.checkout_path) throw new Error('Associated worktree has no checkout path');
    command('wt', ['-C', worktree.checkout_path, 'archive']);
  }
  // Never close after an archive failure or broaden this to --group.
  query('workspace', 'close', workspaceId);
}

try { archive(); }
catch (error) {
  console.error(String(error));
  try { command(herdr, ['notification', 'show', 'Archive failed', '--body', String(error)]); } catch {}
  process.exitCode = 1;
}
