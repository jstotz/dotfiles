import { createConnection } from 'node:net';

// The installed CLI exposes workspace.move only through the socket API.
export function moveWorkspaceFirst(socketPath: string, workspaceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let buffer = '';
    const fail = (error: Error) => { socket.destroy(); reject(error); };
    socket.setTimeout(5000, () => fail(new Error('Timed out moving micro workspace')));
    socket.on('error', fail);
    socket.on('connect', () => socket.write(JSON.stringify({
      id: 'micro:workspace:move', method: 'workspace.move',
      params: { workspace_id: workspaceId, insert_index: 0 },
    }) + '\n'));
    socket.on('data', chunk => {
      buffer += chunk.toString();
      if (!buffer.includes('\n')) return;
      try {
        const response = JSON.parse(buffer.slice(0, buffer.indexOf('\n')));
        if (response.error) throw new Error(JSON.stringify(response.error));
        if (!response.result) throw new Error('Missing workspace move result');
        socket.destroy();
        resolve();
      } catch (error) { fail(error as Error); }
    });
    socket.on('end', () => fail(new Error('Herdr closed the connection before responding')));
  });
}
