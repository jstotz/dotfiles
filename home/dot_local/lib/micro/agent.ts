// Changing this starts a new conversation; saved sessions belong to one kind.
export const kind = 'claude';

// Agent names can be cleared or changed independently of the running session.
// Recover only the saved conversation, never a different occupant of its pane.
export function findMicroAgent(query: (...args: string[]) => any,
  state: { pane?: string; session?: string }, config: string) {
  let agent;
  try { agent = query('agent', 'get', 'micro').agent; } catch {}
  if (agent) {
    if (agent.cwd !== config) throw new Error('An agent named micro already exists outside the micro directory');
    if (agent.agent !== kind) throw new Error(`micro is running ${agent.agent}; quit it and reopen micro to start ${kind}`);
    return agent;
  }
  if (!state.pane) return;
  try { agent = query('agent', 'get', state.pane).agent; } catch { return; }
  if (!agent) return;
  if (agent.cwd !== config || agent.agent !== kind || !state.session
    || agent.agent_session?.value !== state.session) {
    throw new Error('micro’s saved pane has another occupant');
  }
  return agent;
}
