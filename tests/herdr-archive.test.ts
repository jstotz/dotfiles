import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const launcher = resolve('home/dot_local/lib/herdr-archive/main.ts');
for (const scenario of ['linked', 'plain', 'primary', 'archive-fails', 'pane-context', 'close-fails']) {
  test(`Archive: ${scenario}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'herdr-archive-'));
    const bin = join(root, 'bin'); mkdirSync(bin);
    const script = `#!/usr/bin/env bun
      import { appendFileSync } from 'node:fs';
      const args = process.argv.slice(2);
      const scenario = process.env.SCENARIO;
      const isWt = process.argv[1].endsWith('/wt');
      appendFileSync(process.env.TEST_ROOT + '/calls', JSON.stringify([isWt ? 'wt' : 'herdr', ...args]) + '\\n');
      if (isWt) {
        if (scenario === 'archive-fails') { console.error('archive refused'); process.exit(1); }
        process.exit(0);
      }
      if (args[0] === 'pane') console.log(JSON.stringify({result:{pane:{workspace_id:'selected'}}}));
      else if (args[0] === 'workspace' && args[1] === 'get') {
        if (args[2] !== 'selected') process.exit(1);
        const worktree = scenario === 'plain' ? null : {is_linked_worktree: scenario !== 'primary',checkout_path:'/worktrees/selected with spaces'};
        console.log(JSON.stringify({result:{workspace:{workspace_id:'selected',worktree}}}));
      } else if (args[1] === 'close' && scenario === 'close-fails') { console.error('workspace_group_close_required'); process.exit(1); }
      else console.log(JSON.stringify({result:{}}));
    `;
    for (const name of ['herdr', 'wt']) writeFileSync(join(bin, name), script, {mode:0o700});
    const env = {...process.env, PATH:bin+':'+process.env.PATH, HERDR_BIN_PATH:join(bin,'herdr'),
      HERDR_ENV:'1', HERDR_ACTIVE_WORKSPACE_ID:'', HERDR_WORKSPACE_ID:'wrong',
      HERDR_ACTIVE_PANE_ID:'source', HERDR_PANE_ID:'wrong',
      HERDR_PLUGIN_CONTEXT_JSON:scenario === 'pane-context' ? '{}' : JSON.stringify({workspace_id:'selected'}),
      SCENARIO:scenario, TEST_ROOT:root};
    try {
      const child = Bun.spawn([process.execPath, launcher], {env, stdout:'pipe', stderr:'pipe'});
      expect(await child.exited).toBe(['archive-fails','close-fails'].includes(scenario) ? 1 : 0);
      const calls = readFileSync(join(root,'calls'),'utf8').trim().split('\n').map(JSON.parse);
      const archives = calls.filter(c => c[0] === 'wt');
      expect(archives).toEqual(['plain','primary'].includes(scenario) ? [] : [['wt','-C','/worktrees/selected with spaces','archive']]);
      const closes = calls.filter(c => c[1] === 'workspace' && c[2] === 'close');
      expect(closes).toEqual(scenario === 'archive-fails' ? [] : [['herdr','workspace','close','selected']]);
      if (archives.length && closes.length) expect(calls.indexOf(archives[0])).toBeLessThan(calls.indexOf(closes[0]));
      if (scenario === 'pane-context') expect(calls).toContainEqual(['herdr','pane','get','source']);
      if (['archive-fails','close-fails'].includes(scenario)) expect(calls.some(c => c[1] === 'notification')).toBe(true);
    } finally { rmSync(root,{recursive:true,force:true}); }
  });
}
