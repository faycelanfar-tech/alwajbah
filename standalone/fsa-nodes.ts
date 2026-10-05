/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * مزامنة OneDrive بملف مستقل لكل جهاز (الخيار 3).
 *
 * داخل المجلد المشترك:
 *   node-<جهاز>.awj   نسخة كاملة مشفّرة يكتبها هذا الجهاز فقط (لا تعارض في OneDrive)
 *   أي ملف .awj آخر   (alwajbah-data.awj وملفات التعارض القديمة بأسماء الحواسيب) يُقرأ ويُدمج فقط
 *
 * الدمج على مستوى السجل: لكل سجل وقت آخر تعديل، والأحدث يفوز، والحذف يُسجَّل كشاهد حذف.
 */
import { createStore, get, set } from "idb-keyval";
import { encode, decode } from "./fsa";
import type { FileBridge } from "./stubs/local-engine";

const store = createStore("alwajbah-fsa", "handles");
const DIR_KEY = "nodesDir";
const POLL_MS = 3000;
const WRITE_DELAY = 800;
const ACC = "__accounts";

export const nodesSupported = typeof (window as any).showDirectoryPicker === "function";

type Row = Record<string, any>;
interface Meta {
  rows: Record<string, Record<string, number>>; // جدول -> معرف -> وقت
  dead: Record<string, Record<string, number>>; // شواهد الحذف
  tbl: Record<string, number>; // للجداول بلا معرفات
}
interface DB { tables: Record<string, Row[]>; accounts: Row[] }
interface NodeFile { v: 2; device: string; ts: number; db: DB; meta: Meta }

function deviceId() {
  try {
    let d = localStorage.getItem("awj.node");
    if (!d) {
      d = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
      localStorage.setItem("awj.node", d);
    }
    return d;
  } catch { return "DEV"; }
}

const emptyMeta = (): Meta => ({ rows: {}, dead: {}, tbl: {} });
const all = (db: DB): Record<string, Row[]> => ({ ...db.tables, [ACC]: db.accounts ?? [] });
const keyed = (rows: Row[]) => rows.every((r) => r && r.id != null);

function parseDb(raw: string | null): DB | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p?.v === 2 && p.db) return p.db;
    return p?.tables ? { tables: p.tables, accounts: p.accounts ?? [] } : null;
  } catch { return null; }
}

interface Source { db: DB; meta: Meta; base: number }

/** دمج كل المصادر: الأحدث يفوز لكل سجل */
function mergeAll(sources: Source[]): { db: DB; meta: Meta } {
  const meta = emptyMeta();
  const best: Record<string, Map<string, { row: Row; ts: number }>> = {};
  const whole: Record<string, { rows: Row[]; ts: number }> = {};
  for (const s of sources) {
    const tabs = all(s.db);
    for (const [t, rows] of Object.entries(tabs)) {
      if (!Array.isArray(rows)) continue;
      if (!keyed(rows)) {
        const ts = s.meta.tbl[t] ?? s.base;
        if (!whole[t] || ts > whole[t].ts) whole[t] = { rows, ts };
        continue;
      }
      const m = (best[t] ??= new Map());
      for (const r of rows) {
        const id = String(r.id);
        const ts = s.meta.rows[t]?.[id] ?? s.base;
        const cur = m.get(id);
        if (!cur || ts > cur.ts) m.set(id, { row: r, ts });
      }
    }
    for (const [t, ids] of Object.entries(s.meta.dead ?? {})) {
      const d = (meta.dead[t] ??= {});
      for (const [id, ts] of Object.entries(ids)) if (!d[id] || ts > d[id]) d[id] = ts;
    }
  }
  const out: Record<string, Row[]> = {};
  for (const [t, w] of Object.entries(whole)) { out[t] = w.rows; meta.tbl[t] = w.ts; }
  for (const [t, m] of Object.entries(best)) {
    const rows: Row[] = [];
    const rt: Record<string, number> = {};
    for (const [id, { row, ts }] of m) {
      if ((meta.dead[t]?.[id] ?? 0) >= ts) continue;
      rows.push(row); rt[id] = ts;
    }
    out[t] = rows; meta.rows[t] = rt;
  }
  const { [ACC]: accounts = [], ...tables } = out;
  return { db: { tables, accounts }, meta };
}

/** تسجيل أوقات التغييرات المحلية في البيانات الوصفية */
function stamp(prev: DB, next: DB, meta: Meta, now: number): Meta {
  const m: Meta = { rows: { ...meta.rows }, dead: { ...meta.dead }, tbl: { ...meta.tbl } };
  const a = all(prev), b = all(next);
  for (const t of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const pr = a[t] ?? [], nr = b[t] ?? [];
    if (!keyed(pr) || !keyed(nr)) {
      if (JSON.stringify(pr) !== JSON.stringify(nr)) m.tbl[t] = now;
      continue;
    }
    const old = new Map(pr.map((r) => [String(r.id), JSON.stringify(r)]));
    const rt = { ...(m.rows[t] ?? {}) };
    const seen = new Set<string>();
    for (const r of nr) {
      const id = String(r.id); seen.add(id);
      if (old.get(id) !== JSON.stringify(r)) rt[id] = now;
    }
    const dead = { ...(m.dead[t] ?? {}) };
    for (const id of old.keys()) if (!seen.has(id)) { dead[id] = now; delete rt[id]; }
    m.rows[t] = rt; m.dead[t] = dead;
  }
  return m;
}

export async function savedNodesDir(): Promise<any | undefined> {
  try { return await get(DIR_KEY, store); } catch { return undefined; }
}
export async function saveNodesDir(h: any) {
  try { await set(DIR_KEY, h, store); } catch { /* ignore */ }
}
export async function pickNodesDir() {
  return (window as any).showDirectoryPicker({ mode: "readwrite", id: "alwajbah-nodes" });
}
export async function ensureNodesPermission(h: any, ask: boolean) {
  const opts = { mode: "readwrite" };
  if ((await h.queryPermission(opts)) === "granted") return true;
  if (!ask) return false;
  return (await h.requestPermission(opts)) === "granted";
}

export async function makeNodesBridge(dir: any): Promise<FileBridge & { refresh(): Promise<void> }> {
  const dev = deviceId();
  const own = `node-${dev}.awj`;
  const cache = new Map<string, { mtime: number; src: Source | null }>();
  let merged: DB | null = null;
  let meta: Meta = emptyMeta();
  let version = 0;
  let sig = "";
  let busy = false;
  let pending: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  async function scan() {
    const names: string[] = [];
    for await (const [name, h] of (dir as any).entries()) {
      if (h.kind !== "file" || !/\.(awj|json)$/i.test(name) || name.startsWith("txn_") || name.includes(".tmp")) continue;
      names.push(name);
      try {
        const f = await h.getFile();
        const c = cache.get(name);
        if (c && c.mtime === f.lastModified) continue;
        let src: Source | null = null;
        try {
          const text = await decode(await f.text());
          if (text) {
            const p = JSON.parse(text);
            if (p?.v === 2 && p.db) src = { db: p.db, meta: p.meta ?? emptyMeta(), base: 0 };
            else { const db = parseDb(text); if (db) src = { db, meta: emptyMeta(), base: f.lastModified }; }
          }
        } catch { /* ملف قيد المزامنة أو تالف */ }
        cache.set(name, { mtime: f.lastModified, src: src ?? c?.src ?? null });
      } catch { /* غير متاح مؤقتاً */ }
    }
    for (const k of [...cache.keys()]) if (!names.includes(k)) cache.delete(k);
    const sources = [...cache.values()].map((c) => c.src).filter(Boolean) as Source[];
    if (merged) sources.push({ db: merged, meta, base: 0 });
    if (!sources.length) return;
    const r = mergeAll(sources);
    const s = JSON.stringify(r.db);
    if (s !== sig) { sig = s; merged = r.db; meta = r.meta; version++; }
  }

  function flush() {
    if (!merged) return;
    const body: NodeFile = { v: 2, device: dev, ts: Date.now(), db: merged, meta };
    const text = JSON.stringify(body);
    chain = chain.then(async () => {
      try {
        const h = await dir.getFileHandle(own, { create: true });
        const w = await h.createWritable();
        await w.write(await encode(text));
        await w.close();
        const f = await h.getFile();
        cache.set(own, { mtime: f.lastModified, src: { db: body.db, meta: body.meta, base: 0 } });
      } catch (e) { console.error("تعذّر حفظ ملف الجهاز", e); }
    });
  }

  const refresh = async () => {
    if (busy) return;
    busy = true;
    try { await scan(); } catch { /* المجلد غير متاح */ } finally { busy = false; }
  };

  await refresh();
  (window as any).__awjRefresh = refresh;
  // أول تشغيل على هذا الجهاز: ننشئ ملفه ليضم كل البيانات المدموجة (بما فيها ملفات التعارض القديمة)
  if (merged && !cache.has(own)) flush();
  window.setInterval(() => { void refresh(); }, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh(); });

  return {
    refresh,
    getPath: () => `${dir.name} / ${own}`,
    setPath: () => false,
    choosePath: () => {
      void (async () => {
        try {
          const nd = await pickNodesDir();
          if (await ensureNodesPermission(nd, true)) { await saveNodesDir(nd); location.reload(); }
        } catch { /* أُلغي */ }
      })();
      return null;
    },
    stat: () => (version === 0 ? null : version),
    read: () => (merged ? JSON.stringify(merged) : null),
    write: (t: string) => {
      const next = parseDb(t);
      if (!next) return false;
      const now = Date.now();
      meta = stamp(merged ?? { tables: {}, accounts: [] }, next, meta, now);
      merged = next;
      sig = JSON.stringify(next);
      version++;
      if (pending) window.clearTimeout(pending);
      pending = window.setTimeout(() => { pending = null; flush(); }, WRITE_DELAY);
      return true;
    },
  };
}
