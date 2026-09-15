import { reviewPort, deliverComments } from '../home/dot_local/lib/herdr-review/difit';
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const launcher = resolve('home/dot_local/lib/herdr-review/main.ts');
const wait = async (check: () => boolean) => {
  for (let i = 0; i < 150; i++) { if (check()) return; await Bun.sleep(30); }
  throw new Error('Timed out');
};
for (const scenario of ['success', 'changed-agent', 'delivery-failure', 'close-without-feedback']) {
  test(`captured target, reuse, and ${scenario}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'herdr-review-test-'));
    const bin = join(root, 'bin'); mkdirSync(bin);
    const writeExe = (name: string, text: string) => writeFileSync(join(bin, name), '#!/usr/bin/env bun\n' + text, { mode: 0o700 });
    writeExe('git', `console.log(process.argv.includes('--git-path') ? ${JSON.stringify(root+'/absent-index')} : ${JSON.stringify(root)});`);
    writeExe('herdr', `
      import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
      const args = process.argv.slice(2); const root = process.env.TEST_ROOT;
      appendFileSync(root + '/calls', JSON.stringify(args) + '\\n');
      if (args[0] === 'agent' && args[1] === 'prompt' && process.env.SCENARIO === 'delivery-failure') process.exit(1);
      if (args[0] === 'plugin' && args[2] === 'open') {
        writeFileSync(root+'/opened',args[args.indexOf('--target-pane')+1]);
        console.log(JSON.stringify({result:{plugin_pane:{pane:{pane_id:'browser'}}}})); process.exit(0);
      }
      if (args[0] === 'pane' && args[1] === 'get' && args[2] === 'browser' && existsSync(root+'/finish')) process.exit(1);
      const pane = { pane_id:'original', tab_id:'tab', workspace_id:'workspace', agent:'codex', cwd:root,
        terminal_id: 'term', agent_session:{value: existsSync(root+'/changed') ? 'replacement' : 'original'} };
      console.log(JSON.stringify({result:{pane}}));
    `);
    writeExe('difit', `
      import { existsSync } from 'node:fs';
      const args = process.argv.slice(2);
      if (args.includes('--keep-alive')) process.exit(1);
      console.log('difit server started on http://127.0.0.1:'+args[args.indexOf('--port')+1]);
      const finish = () => {
        console.log('Client disconnected, shutting down server...');
        if (process.env.SCENARIO !== 'close-without-feedback') console.log(${JSON.stringify('📝 Comments from review session:\n'+'='.repeat(50)+'\nfile.ts:L1\nTest feedback\n'+'='.repeat(50)+'\nTotal comments: 1')});
        process.exit(0);
      };
      process.on('SIGINT',finish);
      setInterval(() => { if (existsSync(process.env.TEST_ROOT+'/finish')) finish(); },30);
    `);
    const env = { ...process.env, HOME:root, XDG_STATE_HOME:join(root,'state'), PATH:bin+':'+process.env.PATH,
      HERDR_BIN_PATH:join(bin,'herdr'), HERDR_ENV:'1', HERDR_SOCKET_PATH:'mock', HERDR_PANE_ID:'wrong',
      HERDR_ACTIVE_PANE_ID:'original', TEST_ROOT:root, SCENARIO:scenario };
    const run = async () => {
      const child = Bun.spawn([process.execPath, launcher], {env, stdout:'pipe', stderr:'pipe'});
      expect(await child.exited).toBe(0);
    };
    try {
      await run(); await wait(() => existsSync(join(root,'opened')));
      expect(readFileSync(join(root,'opened'),'utf8')).toBe('original');
      const stateRoot = join(root,'state/herdr-review');
      const directory = join(stateRoot,readdirSync(stateRoot)[0]);
      const originalPid = JSON.parse(readFileSync(join(directory,'state.json'),'utf8')).pid;
      await run();
      expect(JSON.parse(readFileSync(join(directory,'state.json'),'utf8')).pid).toBe(originalPid);
      if (scenario === 'changed-agent') writeFileSync(join(root,'changed'),'');
      writeFileSync(join(root,'finish'),'');
      await wait(() => !existsSync(join(directory,'active')));
      const calls = readFileSync(join(root,'calls'),'utf8').trim().split('\n').map(x => JSON.parse(x));
      const sends = calls.filter(x => x[0] === 'agent' && x[1] === 'prompt');
      expect(sends.length).toBe(['changed-agent','close-without-feedback'].includes(scenario) ? 0 : 1);
      if (sends.length) { expect(sends[0].slice(0,3)).toEqual(['agent','prompt','original']); expect(sends[0][3]).toContain('Test feedback'); expect(sends[0][3]).not.toContain('shutting down'); }
      expect(existsSync(join(directory,'feedback.md'))).toBe(['changed-agent','delivery-failure'].includes(scenario));
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
}

const envelope = (comments: string[]) => `logs\n📝 Comments from review session:\n${'='.repeat(50)}\n${comments.join('\n=====\n')}\n${'='.repeat(50)}\nTotal comments: ${comments.length}\n`;
test('only new or edited comments are delivered; failed delivery is retryable', () => {
  const directory = mkdtempSync(join(tmpdir(),'difit-delivery-'));
  const sent: string[] = [];
  const send = (text: string) => { sent.push(text); };
  try {
    deliverComments(envelope(['a.ts:L1\nfirst']),directory,send);
    deliverComments(envelope(['a.ts:L1\nfirst']),directory,send);
    expect(sent.length).toBe(1);
    deliverComments(envelope(['a.ts:L1\nfirst','b.ts:L2\nsecond']),directory,send);
    expect(sent[1]).not.toContain('first');
    expect(sent[1]).toContain('second');
    expect(() => deliverComments(envelope(['a.ts:L1\nedited']),directory,() => { throw Error('failed'); })).toThrow('failed');
    deliverComments(envelope(['a.ts:L1\nedited']),directory,send);
    expect(sent[2]).toContain('edited');
    deliverComments('No comments',directory,send);
    expect(sent.length).toBe(3);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('a fallback port is rejected before opening a browser', async () => {
  const { reviewDifit } = await import('../home/dot_local/lib/herdr-review/difit');
  const root = mkdtempSync(join(tmpdir(),'difit-port-'));
  const previousPath = process.env.PATH;
  try {
    writeFileSync(join(root,'difit'), '#!/usr/bin/env bun\nconsole.log("difit server started on http://127.0.0.1:1"); setInterval(() => {},1000);', {mode:0o700});
    process.env.PATH = root+':'+previousPath;
    let opened = false;
    await expect(reviewDifit({repo:root},root,() => { opened = true; },() => root+'/index',() => {})).rejects.toThrow('busy');
    expect(opened).toBe(false);
  } finally { process.env.PATH = previousPath; rmSync(root,{recursive:true,force:true}); }
});
