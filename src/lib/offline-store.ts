import { createStore, get, set, del, keys } from "idb-keyval";

const store = typeof window !== "undefined" ? createStore("alwajbah-offline", "kv") : undefined;

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (!store) return undefined;
  try {
    return (await get(key, store)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown) {
  if (!store) return;
  try {
    await set(key, value, store);
  } catch {
    /* ignore quota errors */
  }
}

export async function kvDel(key: string) {
  if (!store) return;
  try {
    await del(key, store);
  } catch {
    /* ignore */
  }
}

export async function kvKeys(): Promise<string[]> {
  if (!store) return [];
  try {
    return (await keys(store)) as string[];
  } catch {
    return [];
  }
}

export interface OutboxEntry {
  id: string;
  table: string;
  op: "insert" | "update" | "delete" | "upsert";
  payload: unknown;
  filters: [string, unknown[]][];
  createdAt: number;
  error?: string;
}

const OUTBOX_KEY = "outbox";

const listeners = new Set<() => void>();

export function subscribeOffline(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyOffline() {
  listeners.forEach((l) => l());
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  return (await kvGet<OutboxEntry[]>(OUTBOX_KEY)) ?? [];
}

export async function writeOutbox(entries: OutboxEntry[]) {
  await kvSet(OUTBOX_KEY, entries);
  notifyOffline();
}

export async function pushOutbox(entry: Omit<OutboxEntry, "id" | "createdAt">) {
  const list = await readOutbox();
  list.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  });
  await writeOutbox(list);
}
