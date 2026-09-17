import { spawnSync } from 'node:child_process';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
function command(bin: string, args: string[]): string {
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 10000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${bin} failed`);
  return result.stdout.trim();
}
const query = (...args: string[]) => JSON.parse(command(herdr, args)).result;

function launch() {
  if (process.env.HERDR_ENV !== '1' && !process.env.HERDR_ACTIVE_PANE_ID) throw new Error('Run inside Herdr');
  const source = process.env.HERDR_ACTIVE_PANE_ID || process.env.HERDR_PANE_ID;
  if (!source) throw new Error('Herdr did not identify the calling pane');
  const pane = query('pane', 'get', source).pane;
  const tabs = query('tab', 'list', '--workspace', pane.workspace_id).tabs;
  const existing = tabs.find((tab: any) => tab.label === 'Code Review');
  if (existing) {
    query('tab', 'focus', existing.tab_id);
    return;
  }
  const repo = command('git', ['-C', pane.foreground_cwd || pane.cwd, 'rev-parse', '--show-toplevel']);
  const opened = query('plugin', 'pane', 'open', '--plugin', 'dotfiles.review', '--entrypoint', 'nvim',
    '--placement', 'tab', '--workspace', pane.workspace_id, '--cwd', repo, '--focus');
  query('tab', 'rename', opened.plugin_pane.pane.tab_id, 'Code Review');
  // Explicit focus also updates the attached client's selected tab.
  query('tab', 'focus', opened.plugin_pane.pane.tab_id);
  return;
}

try { launch(); }
catch (error) {
  console.error(String(error));
  try { command(herdr, ['notification', 'show', 'Code review', '--body', String(error)]); } catch {}
  process.exitCode = 1;
}
