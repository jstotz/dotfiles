import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const session = resolve('home/dot_local/lib/herdr-review/session.ts');

type Agent = { pane_id: string; tab_id: string; workspace_id?: string };
async function run(opts: { markdown: string; agents: Agent[]; requester?: string; pick?: number }) {
  const root = mkdtempSync(join(tmpdir(), 'herdr-review-session-test-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const writeExe = (name: string, text: string) => writeFileSync(join(bin, name), '#!/usr/bin/env bun\n' +
    `import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
     const args = process.argv.slice(2); const root = process.env.TEST_ROOT;
     appendFileSync(root + '/calls', JSON.stringify(['${name}', ...args]) + '\\n');\n` + text, {mode:0o700});
  writeExe('tuicr', `
    if (args[0] === 'review') process.exit(0);
    console.error('tuicr-session: repo@main/staged-and-unstaged/abc');
    process.stdout.write(process.env.TEST_MARKDOWN);
  `);
  writeExe('herdr', `
    const agents = JSON.parse(process.env.TEST_AGENTS);
    const reply = (result) => { console.log(JSON.stringify({result})); process.exit(0); };
    if (args[0] === 'agent' && args[1] === 'list') reply({agents});
    if (args[0] === 'pane' && args[1] === 'get') reply({pane: args[2] === 'review-pane'
      ? {pane_id:'review-pane', tab_id:'review-tab', workspace_id:'workspace'}
      : {pane_id:args[2], tab_id:'shell-tab', workspace_id:'workspace'}});
    if (args[0] === 'pane' && args[1] === 'send-text') writeFileSync(root + '/sent', args[3]);
    reply({});
  `);
  writeExe('fzf', `
    const lines = readFileSync(0, 'utf8').split('\\n');
    if (process.env.TEST_PICK === '') process.exit(130);
    console.log(lines[Number(process.env.TEST_PICK)]);
  `);
  writeExe('pbcopy', `writeFileSync(root + '/clipboard', readFileSync(0, 'utf8'));`);
  const state = join(root, 'state');
  if (opts.requester) {
    mkdirSync(join(state, 'herdr-review'), { recursive: true });
    writeFileSync(join(state, 'herdr-review/workspace.json'), JSON.stringify({ pane_id: opts.requester }));
  }
  const agents = opts.agents.map(a => ({ agent: 'claude', workspace_id: 'workspace', ...a }));
  const env = {...process.env, PATH:bin+':'+process.env.PATH, HERDR_BIN_PATH:join(bin,'herdr'), HERDR_ENV:'1',
    HERDR_PANE_ID:'review-pane', XDG_STATE_HOME:state, TEST_ROOT:root, TEST_MARKDOWN:opts.markdown,
    TEST_AGENTS:JSON.stringify(agents), TEST_PICK:opts.pick === undefined ? '' : String(opts.pick)};
  try {
    const child = Bun.spawn([process.execPath, session], {env, stdout:'pipe', stderr:'pipe'});
    const code = await child.exited;
    const read = (name: string) => existsSync(join(root, name)) ? readFileSync(join(root, name), 'utf8') : undefined;
    const calls = (read('calls') || '').trim().split('\n').filter(Boolean).map(x => JSON.parse(x));
    return { code, calls, sent: read('sent'), clipboard: read('clipboard') };
  } finally { rmSync(root, {recursive:true, force:true}); }
}

const sentTo = (calls: string[][]) => calls.find(x => x[0] === 'herdr' && x[2] === 'send-text')?.[3];

test('sends the export to the requesting agent without submitting, then clears only comments', async () => {
  const r = await run({ markdown: '# Review\n', requester: 'agent-b',
    agents: [{pane_id:'agent-a', tab_id:'a'}, {pane_id:'agent-b', tab_id:'b'}] });
  expect(r.code).toBe(0);
  expect(r.sent).toBe('# Review');
  expect(sentTo(r.calls)).toBe('agent-b');
  expect(r.calls.some(x => x[0] === 'herdr' && x[1] === 'agent' && x[2] === 'prompt')).toBe(false);
  expect(r.calls).toContainEqual(['tuicr', 'review', 'clearc', '--session', 'repo@main/staged-and-unstaged/abc']);
  expect(r.calls.at(-1)).toEqual(['herdr', 'agent', 'focus', 'agent-b']);
  expect(r.calls.some(x => x[0] === 'fzf')).toBe(false);
});

test('uses the only agent in the requesting tab when review was requested from a shell', async () => {
  const r = await run({ markdown: 'x', requester: 'shell',
    agents: [{pane_id:'other', tab_id:'elsewhere'}, {pane_id:'sibling', tab_id:'shell-tab'}] });
  expect(sentTo(r.calls)).toBe('sibling');
});

test('ignores agents in other workspaces and asks when the target is ambiguous', async () => {
  const agents = [{pane_id:'remote', tab_id:'r', workspace_id:'other'}, {pane_id:'one', tab_id:'1'}, {pane_id:'two', tab_id:'2'}];
  const r = await run({ markdown: 'x', requester: 'shell', agents, pick: 1 });
  expect(r.calls.some(x => x[0] === 'fzf')).toBe(true);
  expect(sentTo(r.calls)).toBe('two');
});

test('keeps comments on the clipboard when no agent is chosen', async () => {
  const r = await run({ markdown: 'x', agents: [{pane_id:'one', tab_id:'1'}, {pane_id:'two', tab_id:'2'}] });
  expect(r.clipboard).toBe('x');
  expect(sentTo(r.calls)).toBeUndefined();
  expect(r.calls.some(x => x[0] === 'tuicr' && x[1] === 'review')).toBe(false);
});

test('does nothing after quitting without an export', async () => {
  const r = await run({ markdown: '', requester: 'agent', agents: [{pane_id:'agent', tab_id:'a'}] });
  expect(r.code).toBe(0);
  expect(r.calls.filter(x => x[0] !== 'tuicr')).toEqual([]);
});
