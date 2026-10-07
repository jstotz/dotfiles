import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const launcher = resolve('home/dot_local/lib/herdr-review/main.ts');

test.each(['Code Review', '[3] Code Review', '[12] Code Review'])(
  'reuses the review tab after it is labeled %s, including from a shell', async (label) => {
  const root = mkdtempSync(join(tmpdir(), 'herdr-review-test-'));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const writeExe = (name: string, text: string) => writeFileSync(join(bin, name), '#!/usr/bin/env bun\n' + text, {mode:0o700});
  writeExe('git', `console.log(${JSON.stringify(root)});`);
  writeExe('herdr', `
    import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
    const args = process.argv.slice(2); const root = process.env.TEST_ROOT;
    appendFileSync(root + '/calls', JSON.stringify(args) + '\\n');
    if (args[0] === 'tab' && args[1] === 'list') {
      if (args[2] !== '--workspace' || args[3] !== 'workspace') process.exit(1);
      const tabs = [{tab_id:'unrelated-tab',label:'[1] Code Review notes'}];
      if (existsSync(root+'/review-named')) tabs.push({tab_id:'review-tab',label:process.env.TEST_REVIEW_LABEL});
      console.log(JSON.stringify({result:{tabs}})); process.exit(0);
    }
    if (args[0] === 'tab' && args[1] === 'rename' && args[3] === 'Code Review') writeFileSync(root+'/review-named','');
    if (args[0] === 'plugin' && args[2] === 'open') {
      const isTab = args[args.indexOf('--placement')+1] === 'tab';
      if (isTab && (args.includes('--target-pane') || !args.includes('--workspace'))) process.exit(1);
      console.log(JSON.stringify({result:{plugin_pane:{pane:{pane_id:'review-pane',tab_id:'review-tab'}}}})); process.exit(0);
    }
    const pane = {pane_id:'original',tab_id:'tab',workspace_id:'workspace',cwd:root};
    console.log(JSON.stringify({result:{pane}}));
  `);

  const env = {...process.env, PATH:bin+':'+process.env.PATH, HERDR_BIN_PATH:join(bin,'herdr'),
    HERDR_ENV:'1', HERDR_PANE_ID:'wrong', HERDR_ACTIVE_PANE_ID:'original', TEST_ROOT:root, TEST_REVIEW_LABEL:label};
  try {
    for (let i = 0; i < 2; i++) {
      const child = Bun.spawn([process.execPath, launcher], {env, stdout:'pipe', stderr:'pipe'});
      expect(await child.exited).toBe(0);
    }
    const calls = readFileSync(join(root,'calls'),'utf8').trim().split('\n').map(x => JSON.parse(x));
    const open = calls.find(x => x[0] === 'plugin' && x[2] === 'open');
    expect(open[open.indexOf('--entrypoint')+1]).toBe('nvim');
    expect(open[open.indexOf('--placement')+1]).toBe('tab');
    expect(open[open.indexOf('--workspace')+1]).toBe('workspace');
    expect(open).not.toContain('--target-pane');
    expect(calls).toContainEqual(['tab','rename','review-tab','Code Review']);
    expect(calls.filter(x => x[0] === 'plugin' && x[2] === 'open')).toHaveLength(1);
    expect(calls.filter(x => x[0] === 'tab' && x[1] === 'focus')).toEqual([['tab','focus','review-tab'],['tab','focus','review-tab']]);
    expect(open[open.indexOf('--cwd')+1]).toBe(root);
    expect(calls.some(x => x[0] === 'agent' && x[1] === 'prompt')).toBe(false);
    expect(existsSync(join(root,'clipboard'))).toBe(false);

    expect(calls).toContainEqual(['pane','get','original']);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
