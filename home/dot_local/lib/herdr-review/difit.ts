import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Browser review state belongs to this origin, so reject difit's port fallback.
export const reviewPort = (repo: string) => 20000 + parseInt(createHash('sha256').update(repo).digest('hex').slice(0, 8), 16) % 20000;

export function deliverComments(output: string, directory: string, send: (feedback: string) => void) {
  // difit 5.0.12 prints this envelope on shutdown, mixed with lifecycle logs.
  const match = output.match(/📝 Comments from review session:\n={50}\n([\s\S]*?)\n={50}\nTotal comments: (\d+)/);
  if (!match) {
    if (output.includes('📝 Comments from review session:')) throw new Error('Incomplete difit feedback; see launcher.log');
    return;
  }
  if (Number(match[2]) === 0) return;
  const comments = match[1].split('\n=====\n');
  if (comments.length !== Number(match[2])) throw new Error('Unrecognized difit feedback format; see launcher.log');
  const path = join(directory, 'delivered.json');
  const delivered = new Set<string>(existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : []);
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  const pending = comments.filter(comment => !delivered.has(hash(comment)));
  if (!pending.length) return;
  send(`📝 Comments from review session:\n${'='.repeat(50)}\n${pending.join('\n=====\n')}\n${'='.repeat(50)}\nTotal comments: ${pending.length}\n`);
  // Record only after successful delivery. Failed feedback remains retryable.
  pending.forEach(comment => delivered.add(hash(comment)));
  writeFileSync(path + '.tmp', JSON.stringify([...delivered]), { mode: 0o600 });
  renameSync(path + '.tmp', path);
}

export async function reviewDifit(state: any, directory: string, query: (...args: string[]) => any,
  command: (bin: string, args: string[], options?: any) => string,
  send: (feedback: string) => void) {
  const origin = `http://127.0.0.1:${reviewPort(state.repo)}`;
  // difit's untracked-file support runs git add -N. Use a private index so
  // opening a review never changes the user's staging area.
  const index = resolve(state.repo, command('git', ['-C', state.repo, 'rev-parse', '--git-path', 'index']));
  const privateIndex = join(directory, 'index');
  rmSync(privateIndex, { force: true });
  if (existsSync(index)) copyFileSync(index, privateIndex);
  let base = 'HEAD';
  const candidates = [];
  try { candidates.push(command('git', ['-C', state.repo, 'symbolic-ref', 'refs/remotes/origin/HEAD'])); } catch {}
  candidates.push('origin/main', 'origin/master', 'main', 'master');
  for (const candidate of candidates) {
    try { base = command('git', ['-C', state.repo, 'merge-base', candidate, 'HEAD']); break; } catch {}
  }
  const child = spawn('difit', ['.', base, '--include-untracked', '--no-open', '--host', '127.0.0.1', '--port', String(reviewPort(state.repo))], {
    cwd: state.repo, env: { ...process.env, GIT_INDEX_FILE: privateIndex }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  let output = '';
  child.stdout!.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
  const closed = new Promise<number | null>(resolve => child.on('close', resolve));
  let pane = '';
  let poll: ReturnType<typeof setInterval> | undefined;
  let killTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => done(new Error('difit did not start within 30 seconds')), 30000);
      const done = (error?: Error) => {
        clearTimeout(timeout);
        child.stdout!.off('data', ready);
        error ? reject(error) : resolve();
      };
      const ready = () => {
        const match = output.match(/difit server started on (http:\/\/[^\s]+)/);
        if (match) done(match[1] === origin ? undefined : new Error(`Review port ${reviewPort(state.repo)} is busy; close its other review and retry`));
      };
      child.stdout!.on('data', ready);
      child.on('error', done);
      child.on('close', () => done(new Error('difit exited before opening')));
    });
    const opened = query('plugin', 'pane', 'open', '--plugin', 'dotfiles.review', '--entrypoint', 'browser',
      '--placement', 'zoomed', '--target-pane', state.pane, '--env', `HERDR_REVIEW_URL=${origin}`, '--focus');
    pane = opened.plugin_pane.pane.pane_id;
    writeFileSync(join(directory, 'handle.json'), JSON.stringify({ paneId: pane }), { mode: 0o600 });
    // Normally browser disconnect stops difit. Also handle a pane closed before
    // the page connected: SIGINT asks difit to print comments before exiting.
    poll = setInterval(() => {
      try { query('pane', 'get', pane); } catch {
        clearInterval(poll);
        if (child.exitCode === null) {
          child.kill('SIGINT');
          killTimeout = setTimeout(() => child.kill('SIGKILL'), 5000);
        }
      }
    }, 1000);
    const code = await closed;
    if (code !== 0) throw new Error(`difit exited unsuccessfully (${code}); see launcher.log`);
    deliverComments(output, directory, send);
  } finally {
    clearInterval(poll);
    clearTimeout(killTimeout);
    if (pane) { try { query('plugin', 'pane', 'close', pane); } catch {} }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
}
