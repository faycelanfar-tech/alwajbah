import { supabase as realSupabase } from "@/integrations/supabase/client";
import {
  pushOutbox,
  readOutbox,
  writeOutbox,
  notifyOffline,
  subscribeOffline,
  type OutboxEntry,
} from "./offline-store";

/**
 * عميل بيانات يعمل أولاً على الجهاز:
 * - القراءة تمر كما هي (ونتائجها محفوظة في ذاكرة الجهاز عبر حفظ ذاكرة الاستعلامات).
 * - الكتابة أثناء انقطاع الاتصال تُحفظ في طابور محلي وتُرسل تلقائياً عند عودة الشبكة.
 */

const WRITE_OPS = new Set(["insert", "update", "delete", "upsert"]);
const FILTER_OPS = new Set([
  "eq", "neq", "in", "is", "gt", "gte", "lt", "lte",
  "like", "ilike", "match", "contains", "not", "or", "filter",
]);

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function looksLikeNetworkError(err: unknown) {
  const msg = (err as { message?: string })?.message ?? String(err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|timeout/i.test(msg);
}

function optimisticResult(op: string, payload: unknown) {
  if (op === "insert" || op === "upsert") {
    const stamp = (row: Record<string, unknown>) => ({
      id: row.id ?? (globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`),
      created_at: row.created_at ?? new Date().toISOString(),
      ...row,
    });
    const data = Array.isArray(payload)
      ? (payload as Record<string, unknown>[]).map(stamp)
      : stamp((payload ?? {}) as Record<string, unknown>);
    return { data, error: null, count: null, status: 202, statusText: "Queued" };
  }
  return { data: null, error: null, count: null, status: 202, statusText: "Queued" };
}

async function runWrite(
  table: string,
  op: OutboxEntry["op"],
  payload: unknown,
  filters: [string, unknown[]][],
  builder: PromiseLike<{ error: unknown }>,
) {
  if (!isOnline()) {
    await pushOutbox({ table, op, payload, filters });
    return optimisticResult(op, payload);
  }
  try {
    const res = (await builder) as { error?: unknown };
    if (res?.error && looksLikeNetworkError(res.error)) {
      await pushOutbox({ table, op, payload, filters });
      return optimisticResult(op, payload);
    }
    return res;
  } catch (err) {
    if (looksLikeNetworkError(err)) {
      await pushOutbox({ table, op, payload, filters });
      return optimisticResult(op, payload);
    }
    throw err;
  }
}

function wrapBuilder(
  table: string,
  op: OutboxEntry["op"],
  payload: unknown,
  builder: Record<string, unknown>,
  filters: [string, unknown[]][],
): unknown {
  return new Proxy(builder, {
    get(target: Record<string, unknown>, prop) {
      if (prop === "then") {
        return (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
          runWrite(table, op, payload, filters, target as unknown as PromiseLike<{ error: unknown }>).then(onOk, onErr);
      }
      const value = target[prop as string];
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          if (typeof prop === "string" && FILTER_OPS.has(prop)) filters.push([prop, args]);
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (result && typeof result === "object") {
            return wrapBuilder(table, op, payload, result as Record<string, unknown>, filters);
          }
          return result;
        };
      }
      return value;
    },
  });
}

function offlineFrom(table: string) {
  const real = (realSupabase as unknown as { from: (t: string) => Record<string, unknown> }).from(table);
  return new Proxy(real, {
    get(target: Record<string, unknown>, prop) {
      const value = target[prop as string];
      if (typeof value !== "function") return value;
      if (typeof prop === "string" && WRITE_OPS.has(prop)) {
        return (...args: unknown[]) => {
          const builder = (value as (...a: unknown[]) => unknown).apply(target, args) as Record<string, unknown>;
          return wrapBuilder(table, prop as OutboxEntry["op"], args[0], builder, []);
        };
      }
      return (value as (...a: unknown[]) => unknown).bind(target);
    },
  });
}

type SupabaseLike = typeof realSupabase;

export const db = new Proxy({} as SupabaseLike, {
  get(_t, prop) {
    if (prop === "from") return (table: string) => offlineFrom(table);
    const value = (realSupabase as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(realSupabase) : value;
  },
}) as SupabaseLike;

/* ------------------------- محرك المزامنة ------------------------- */

let syncing = false;

export function isSyncing() {
  return syncing;
}

export async function syncOutbox(): Promise<{ pushed: number; failed: number }> {
  if (syncing || !isOnline()) return { pushed: 0, failed: 0 };
  syncing = true;
  notifyOffline();
  let pushed = 0;
  let failed = 0;
  try {
    let list = await readOutbox();
    const remaining: OutboxEntry[] = [];
    for (const entry of list) {
      try {
        const table = (realSupabase as unknown as { from: (t: string) => Record<string, unknown> }).from(entry.table);
        const opFn = table[entry.op] as (p?: unknown) => Record<string, unknown>;
        let builder: Record<string, unknown> =
          entry.op === "delete" ? opFn.call(table) : opFn.call(table, entry.payload);
        for (const [fn, args] of entry.filters) {
          const f = builder[fn] as (...a: unknown[]) => Record<string, unknown>;
          if (typeof f === "function") builder = f.apply(builder, args);
        }
        const res = (await (builder as unknown as PromiseLike<{ error?: unknown }>)) as { error?: unknown };
        if (res?.error) {
          if (looksLikeNetworkError(res.error)) {
            remaining.push(entry);
          } else {
            failed++;
          }
        } else {
          pushed++;
        }
      } catch (err) {
        if (looksLikeNetworkError(err)) remaining.push(entry);
        else failed++;
      }
    }
    list = remaining;
    await writeOutbox(list);
  } finally {
    syncing = false;
    notifyOffline();
  }
  return { pushed, failed };
}

export function startSyncEngine(onSynced?: () => void) {
  if (typeof window === "undefined") return () => {};
  const run = async () => {
    const res = await syncOutbox();
    if (res.pushed > 0 && onSynced) onSynced();
  };
  const onOnline = () => {
    notifyOffline();
    void run();
  };
  const onOffline = () => notifyOffline();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  const timer = window.setInterval(run, 60_000);
  void run();
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.clearInterval(timer);
  };
}

export { readOutbox, subscribeOffline };
