/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * صندوق المعاملات المشترك (OneDrive) — بدل ملف بيانات واحد.
 *
 * البنية داخل المجلد المشترك:
 *   school-snapshot.awj        نسخة مرجعية مدموجة (مشفّرة)
 *   txn_<وقت>_<جهاز>_<رمز>.awj  معاملة واحدة مستقلة لكل عملية (مشفّرة)
 *
 * كل جهاز يكتب ملفات خاصة به فقط، فلا يحدث قفل ولا تعارض في OneDrive.
 * المشرف يفحص المجلد كل ثانيتين ويدمج المعاملات الجديدة تلقائياً.
 */
import { createStore, get, set } from "idb-keyval";
import { encode, decode } from "./fsa";
import type { FileBridge } from "./stubs/local-engine";

const store = createStore("alwajbah-fsa", "handles");
const DIR_KEY = "dataDir";
const SNAPSHOT = "school-snapshot.awj";
const TXN_PREFIX = "txn_";
const POLL_MS = 2000;
const COMPACT_AFTER = 60; // عدد ملفات المعاملات قبل الدمج
const KEEP_MS = 10 * 60 * 1000; // لا نحذف معاملة أحدث من 10 دقائق

export const dirSupported = typeof (window as any).showDirectoryPicker === "function";

type Row = Record<string, any>;
interface DB { tables: Record<string, Row[]>; accounts: Row[] }
interface TableDelta { upsert?: Row[]; remove?: any[]; replace?: Row[] }
interface Txn {
  v: 1; id: string; ts: number; device: string;
  tables: Record<string, TableDelta>;
  accounts?: TableDelta;
}

/* ------------------------- أدوات ------------------------- */

function deviceId() {
  try {
    let d = localStorage.getItem("awj.device");
    if (!d) { d = Math.random().toString(36).slice(2, 8); localStorage.setItem("awj.device", d); }
    return d;
  } catch { return "dev"; }
}

function emptyDb(): DB { return { tables: {}, accounts: [] }; }

function parseDb(raw: string | null): DB | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as DB;
    return p?.tables ? { tables: p.tables, accounts: p.accounts ?? [] } : null;
  } catch { return null; }
}

function keyed(rows: Row[]) { return rows.every((r) => r && r.id != null); }

function diffRows(base: Row[], next: Row[]): TableDelta | null {
  if (!keyed(base) || !keyed(next)) {
    return JSON.stringify(base) === JSON.stringify(next) ? null : { replace: next };
  }
  const b = new Map(base.map((r) => [r.id, JSON.stringify(r)]));
  const upsert: Row[] = [];
  const remove: any[] = [];
  const seen = new Set<any>();
  for (const r of next) {
    seen.add(r.id);
    if (b.get(r.id) !== JSON.stringify(r)) upsert.push(r);
  }
  for (const id of b.keys()) if (!seen.has(id)) remove.push(id);
  if (!upsert.length && !remove.length) return null;
  const d: TableDelta = {};
  if (upsert.length) d.upsert = upsert;
  if (remove.length) d.remove = remove;
  return d;
}

function diffDb(base: DB, next: DB): Txn | null {
  const tables: Record<string, TableDelta> = {};
  const names = new Set([...Object.keys(base.tables), ...Object.keys(next.tables)]);
  for (const n of names) {
    const d = diffRows(base.tables[n] ?? [], next.tables[n] ?? []);
    if (d) tables[n] = d;
  }
  const acc = diffRows(base.accounts ?? [], next.accounts ?? []);
  if (!Object.keys(tables).length && !acc) return null;
  const txn: Txn = {
    v: 1,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    device: deviceId(),
    tables,
  };
  if (acc) txn.accounts = acc;
  return txn;
}

function applyDelta(rows: Row[], d: TableDelta): Row[] {
  if (d.replace) return d.replace;
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const r of d.upsert ?? []) map.set(r.id, r);
  for (const id of d.remove ?? []) map.delete(id);
  return [...map.values()];
}

function applyTxn(db: DB, t: Txn): DB {
  const tables = { ...db.tables };
  for (const [n, d] of Object.entries(t.tables ?? {})) tables[n] = applyDelta(tables[n] ?? [], d);
  const accounts = t.accounts ? applyDelta(db.accounts ?? [], t.accounts) : db.accounts ?? [];
  return { tables, accounts };
}

/* ------------------------- المجلد ------------------------- */

export async function savedDir(): Promise<any | undefined> {
  try { return await get(DIR_KEY, store); } catch { return undefined; }
}
export async function saveDir(h: any) {
  try { await set(DIR_KEY, h, store); } catch { /* ignore */ }
}
export async function pickDir() {
  return (window as any).showDirectoryPicker({ mode: "readwrite", id: "alwajbah-shared" });
}
export async function ensureDirPermission(h: any, ask: boolean) {
  const opts = { mode: "readwrite" };
  if ((await h.queryPermission(opts)) === "granted") return true;
  if (!ask) return false;
  return (await h.requestPermission(opts)) === "granted";
}

async function readFileText(dir: any, name: string): Promise<string | null> {
  try {
    const h = await dir.getFileHandle(name);
    const f = await h.getFile();
    const raw = await f.text();
    return await decode(raw);
  } catch { return null; }
}

async function writeFileText(dir: any, name: string, text: string) {
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(await encode(text));
  await w.close();
}

async function listTxnNames(dir: any): Promise<string[]> {
  const out: string[] = [];
  for await (const [name, handle] of (dir as any).entries()) {
    if (handle.kind === "file" && name.startsWith(TXN_PREFIX) && name.endsWith(".awj")) out.push(name);
  }
  return out.sort();
}

function txnTime(name: string): number {
  const m = /^txn_(\d+)_/.exec(name);
  return m ? Number(m[1]) : 0;
}

/* ------------------------- الجسر ------------------------- */

export async function makeDirBridge(dir: any): Promise<FileBridge> {
  const dev = deviceId();
  let merged: DB = emptyDb();
  let version = 0;
  let known = new Set<string>();
  let ready = false;
  let busy = false;
  let chain: Promise<void> = Promise.resolve();

  /** يعيد بناء الحالة من النسخة المرجعية + كل المعاملات */
  async function rebuild(names?: string[]) {
    const snap = parseDb(await readFileText(dir, SNAPSHOT));
    const list = names ?? (await listTxnNames(dir));
    let db = snap ?? emptyDb();
    const applied = new Set<string>();
    for (const n of list) {
      const raw = await readFileText(dir, n);
      if (!raw) continue;
      try {
        const t = JSON.parse(raw) as Txn;
        if (!t || applied.has(t.id)) continue;
        applied.add(t.id);
        db = applyTxn(db, t);
      } catch { /* ملف تالف أو قيد المزامنة */ }
    }
    merged = db;
    known = new Set(list);
    // المجلد فارغ تماماً: نترك version = 0 ليعرف المحرك أنه لا توجد بيانات بعد
    if (snap || list.length) version++;
  }

  /** دمج الملفات الكثيرة في نسخة مرجعية واحدة وحذف القديم */
  async function compact() {
    const names = await listTxnNames(dir);
    if (names.length < COMPACT_AFTER) return;
    await rebuild(names);
    await writeFileText(dir, SNAPSHOT, JSON.stringify(merged));
    const cutoff = Date.now() - KEEP_MS;
    for (const n of names) {
      if (txnTime(n) > cutoff) continue;
      try { await (dir as any).removeEntry(n); } catch { /* مقفول مؤقتاً */ }
    }
    known = new Set(await listTxnNames(dir));
    version++;
  }

  await rebuild();
  ready = true;


  /** فحص دوري: هل وصلت معاملات جديدة من أجهزة أخرى؟ */
  const poll = async () => {
    if (busy || !ready) return;
    busy = true;
    try {
      const names = await listTxnNames(dir);
      const fresh = names.filter((n) => !known.has(n));
      if (fresh.length) {
        let db = merged;
        for (const n of fresh) {
          const raw = await readFileText(dir, n);
          if (!raw) continue;
          try { db = applyTxn(db, JSON.parse(raw) as Txn); } catch { /* تجاهل */ }
        }
        merged = db;
        for (const n of fresh) known.add(n);
        version++;
      }
    } catch { /* المجلد مؤقتاً غير متاح */ }
    finally { busy = false; }
  };
  window.setInterval(() => { void poll(); }, POLL_MS);

  return {
    getPath: () => dir.name,
    setPath: () => false,
    choosePath: () => {
      void (async () => {
        try {
          const nd = await pickDir();
          if (await ensureDirPermission(nd, true)) { await saveDir(nd); location.reload(); }
        } catch { /* أُلغي */ }
      })();
      return null;
    },
    stat: () => (version === 0 ? null : version),
    read: () => (version === 0 ? null : JSON.stringify(merged)),
    write: (t: string) => {
      const next = parseDb(t);
      if (!next) return false;
      const first = version === 0;
      const txn = first ? null : diffDb(merged, next);
      merged = next;
      version++;
      // أول كتابة في مجلد فارغ: نكتب النسخة المرجعية كاملة بدل معاملة ضخمة
      if (first) {
        chain = chain.then(async () => {
          try { await writeFileText(dir, SNAPSHOT, JSON.stringify(merged)); }
          catch (e) { console.error("تعذّر إنشاء ملف البيانات المرجعي", e); }
        });
        return true;
      }
      if (!txn) return true;
      const name = `${TXN_PREFIX}${txn.ts}_${dev}_${txn.id.slice(-6)}.awj`;
      chain = chain.then(async () => {
        try {
          await writeFileText(dir, name, JSON.stringify(txn));
          known.add(name);
          await compact();
        } catch (e) {
          console.error("تعذّر حفظ المعاملة", e);
        }
      });
      return true;
    },
  };
}
