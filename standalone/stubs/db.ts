/* eslint-disable @typescript-eslint/no-explicit-any */
// النسخة المحمولة: لا توجد مزامنة ولا خادم — كل شيء على ذاكرة الجهاز.
import { localClient } from "./local-engine";

export const db: any = localClient;

export function isOnline() {
  return true;
}

export function isSyncing() {
  return false;
}

export interface OutboxEntry {
  id: string;
  table: string;
  op: string;
  payload?: unknown;
  filters?: unknown;
  createdAt: number;
  error?: string;
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  return [];
}

export async function syncOutbox() {
  return { pushed: 0, failed: 0 };
}

export function startSyncEngine(_onSynced?: () => void) {
  return () => {};
}

export function subscribeOffline(_fn: () => void) {
  return () => {};
}

export function notifyOffline() {}
