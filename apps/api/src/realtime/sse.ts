import type { Response } from "express";

type Client = {
  res: Response;
  userId: string;
  removed: boolean;
};

const MAX_CONNECTIONS_PER_USER = 3;
const MAX_TOTAL_CONNECTIONS = 8000;
let totalConnections = 0;

const clientsByUser = new Map<string, Set<Client>>();

function getSet(userId: string) {
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  return set;
}

function removeClient(client: Client) {
  if (client.removed) return; // prevent double-decrement
  client.removed = true;
  const set = clientsByUser.get(client.userId);
  if (set) {
    set.delete(client);
    if (set.size === 0) clientsByUser.delete(client.userId);
  }
  totalConnections--;
}

export function registerSseClient(userId: string, res: Response): (() => void) | null {
  if (totalConnections >= MAX_TOTAL_CONNECTIONS) return null;
  const set = getSet(userId);
  if (set.size >= MAX_CONNECTIONS_PER_USER) {
    // Close oldest connection for this user
    const oldest = set.values().next().value;
    if (oldest) {
      removeClient(oldest);
      try { oldest.res.end(); } catch {}
    }
  }
  const client: Client = { userId, res, removed: false };
  set.add(client);
  totalConnections++;

  res.on("close", () => removeClient(client));

  return () => removeClient(client);
}

function send(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function sendToUser(userId: string, event: string, data: any) {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  for (const client of set) {
    try {
      send(client.res, event, data);
    } catch {
      // ignore broken streams; cleanup handled by 'close'
    }
  }
}

export function broadcast(event: string, data: any) {
  for (const [, set] of clientsByUser) {
    for (const client of set) {
      try {
        send(client.res, event, data);
      } catch {}
    }
  }
}
