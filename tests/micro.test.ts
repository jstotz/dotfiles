import { expect, test } from 'bun:test';
import { captureSession } from '../home/dot_local/lib/micro/session';

const agent = { pane_id: 'pane', terminal_id: 'terminal', agent: 'codex' };
const session = { kind: 'id', agent: 'codex', value: 'current-conversation' };
const pause = async () => {};

test('waits for the session report after interactive readiness', async () => {
  let calls = 0;
  const refresh = () => ++calls === 2 ? { ...agent, agent_session: session } : agent;
  expect(await captureSession(agent, refresh, 4, pause)).toBe('current-conversation');
  expect(calls).toBe(2);
});

test('does not capture a replacement agent session', async () => {
  await expect(captureSession(agent, () => ({ ...agent, terminal_id: 'other', agent_session: session }), 3, pause)).rejects.toThrow('changed');
});

test('reports missing session instead of falling back to a stale ID', async () => {
  await expect(captureSession(agent, () => agent, 2, pause)).rejects.toThrow('not available');
});
