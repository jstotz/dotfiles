import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sourceStatePath } from './source';

// Runs inside the Code Review tab. tuicr keeps reviewed marks in its own
// session store; this sends each export to an agent and clears the sent comments.
const herdr = process.env.HERDR_BIN_PATH || 'herdr';
function run(bin: string, args: string[], input?: string) {
  const result = spawnSync(bin, args, { encoding: 'utf8', input });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${bin} failed`);
  return result.stdout.trim();
}
const query = (...args: string[]) => JSON.parse(run(herdr, args)).result;

function notify(body: string) {
  console.error(body);
  try { run(herdr, ['notification', 'show', 'Code review', '--body', body]); } catch {}
}

function review() {
  // The TUI draws on /dev/tty; stdout carries only the export.
  const result = spawnSync('tuicr', ['--stdout'], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`tuicr exited with status ${result.status}`);
  const session = result.stderr.match(/^tuicr-session: (.+)$/m)?.[1];
  return { markdown: result.stdout.trim(), session };
}

type Agent = { pane_id: string; tab_id: string; agent: string; agent_status?: string; terminal_title_stripped?: string };

function requester(workspaceId: string): string | undefined {
  try { return JSON.parse(readFileSync(sourceStatePath(workspaceId), 'utf8')).pane_id; } catch {}
}

function pick(agents: Agent[]): Agent | undefined {
  const lines = agents.map((a, i) => `${i}\t${a.agent} · ${a.agent_status || 'unknown'} · ${a.terminal_title_stripped || ''}`);
  // fzf draws on /dev/tty, leaving stdout for the selection.
  const result = spawnSync('fzf', ['--delimiter', '\t', '--with-nth', '2..', '--prompt', 'Send review to> '],
    { encoding: 'utf8', input: lines.join('\n'), stdio: ['pipe', 'pipe', 'inherit'] });
  const index = Number(result.stdout.split('\t')[0]);
  return result.status === 0 ? agents[index] : undefined;
}

// Prefer the agent that requested review, then the only agent in its tab,
// then the only agent in the workspace. Ask only when that is ambiguous.
function target(workspaceId: string): Agent | undefined {
  const agents: Agent[] = query('agent', 'list').agents.filter((a: Agent & { workspace_id: string }) => a.workspace_id === workspaceId);
  const source = requester(workspaceId);
  const exact = agents.find(a => a.pane_id === source);
  if (exact) return exact;
  let sourceTab: string | undefined;
  try { if (source) sourceTab = query('pane', 'get', source).pane.tab_id; } catch {}
  const inTab = agents.filter(a => a.tab_id === sourceTab);
  if (inTab.length === 1) return inTab[0];
  if (agents.length <= 1) return agents[0];
  return pick(agents);
}

function main() {
  const { markdown, session } = review();
  if (!markdown) return;
  const self = process.env.HERDR_PANE_ID;
  if (!self) throw new Error('Herdr did not identify the review pane');
  const workspaceId = query('pane', 'get', self).pane.workspace_id;
  const agent = target(workspaceId);
  if (!agent) {
    run('pbcopy', [], markdown);
    notify('No agent selected; review comments are on the clipboard');
    return;
  }
  try {
    // Paste without submitting so the comments can be edited first.
    run(herdr, ['pane', 'send-text', agent.pane_id, markdown]);
  } catch (error) {
    run('pbcopy', [], markdown);
    throw new Error(`Could not send to ${agent.agent}; review comments are on the clipboard. ${error}`);
  }
  // Start the next review without the delivered comments, but keep reviewed marks.
  if (session) {
    try { run('tuicr', ['review', 'clearc', '--session', session]); }
    catch (error) { notify(`Sent, but could not clear tuicr comments: ${error}`); }
  }
  query('agent', 'focus', agent.pane_id);
}

try { main(); }
catch (error) {
  notify(String(error));
  process.exitCode = 1;
}
