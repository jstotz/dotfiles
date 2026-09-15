// Herdr may report interactive readiness before it reports the Codex session ID.
export async function captureSession(agent: any, refresh: () => any,
  attempts = 60, pause: () => Promise<void> = () => Bun.sleep(500)): Promise<string> {
  const { pane_id, terminal_id } = agent;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (agent.pane_id !== pane_id || agent.terminal_id !== terminal_id || agent.agent !== 'codex') {
      throw new Error('micro changed while capturing its session; reopen micro to retry');
    }
    const session = agent.agent_session;
    if (session?.kind === 'id' && session.agent === 'codex' && session.value) return session.value;
    await pause();
    agent = refresh();
  }
  throw new Error('micro is open, but its session ID is not available yet. Finish startup and reopen micro to save its resume ID.');
}
