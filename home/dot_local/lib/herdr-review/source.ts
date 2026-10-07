import { homedir } from 'node:os';
import { join } from 'node:path';

export function sourceStatePath(workspaceId: string) {
  const state = process.env.XDG_STATE_HOME || join(homedir(), '.local/state');
  return join(state, 'herdr-review', `${workspaceId}.json`);
}
