import { expect, test } from 'bun:test';
import { captureSession } from '../home/dot_local/lib/micro/session';
import { findMicroAgent } from '../home/dot_local/lib/micro/agent';

const agent = { pane_id: 'pane', terminal_id: 'terminal', agent: 'codex' };
const session = { kind: 'id', agent: 'codex', value: 'current-conversation' };
const pause = async () => {};

test('recovers the saved micro session when its agent name is missing', () => {
  const live = { ...agent, cwd: '/micro', agent_session: session };
  const query = (...args: string[]) => {
    if (args[2] === 'micro') throw new Error('agent_not_found');
    expect(args).toEqual(['agent', 'get', 'pane']);
    return { agent: live };
  };
  expect(findMicroAgent(query, { pane: 'pane', session: session.value }, '/micro')).toBe(live);
});

test('does not adopt a different conversation in the saved pane', () => {
  const query = (...args: string[]) => {
    if (args[2] === 'micro') throw new Error('agent_not_found');
    return { agent: { ...agent, cwd: '/micro', agent_session: session } };
  };
  expect(() => findMicroAgent(query, { pane: 'pane', session: 'other' }, '/micro')).toThrow('another occupant');
});

test('missing agents leave the normal resume path available', () => {
  expect(findMicroAgent(() => { throw new Error('agent_not_found'); }, { pane: 'gone' }, '/micro')).toBeUndefined();
});

test('refuses a named micro agent outside its directory', () => {
  expect(() => findMicroAgent(() => ({ agent: { ...agent, cwd: '/other' } }), {}, '/micro')).toThrow('outside');
});

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
