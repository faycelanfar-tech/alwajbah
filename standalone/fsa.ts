/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ملف البيانات المشترك (OneDrive) عبر واجهة المتصفح الرسمية File System Access
 * مع ضغط (gzip) وتشفير (AES-256-GCM) لمحتوى الملف.
 */
import { createStore, get, set } from "idb-keyval";
import type { FileBridge } from "./stubs/local-engine";

const store = createStore("alwajbah-fsa", "handles");
const HANDLE_KEY = "dataFile";
const PASS = "Alwajbah#School@Data!2027-ابوجهاد";
const MAGIC = "AWJ1:";

export const fsaSupported = typeof (window as any).showOpenFilePicker === "function";

const te = new TextEncoder();
const td = new TextDecoder();

async function deriveKey(salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", te.encode(PASS), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

async function streamBytes(data: Uint8Array, s: CompressionStream | DecompressionStream) {
  const out = new Blob([data]).stream().pipeThrough(s as any);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toB64(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

let keyCache: { salt: Uint8Array; key: CryptoKey } | null = null;

export async function encode(text: string): Promise<string> {
  if (!keyCache) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    keyCache = { salt, key: await deriveKey(salt) };
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const zipped = await streamBytes(te.encode(text), new CompressionStream("gzip"));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyCache.key, zipped));
  const all = new Uint8Array(16 + 12 + ct.length);
  all.set(keyCache.salt, 0); all.set(iv, 16); all.set(ct, 28);
  return MAGIC + toB64(all);
}

export async function decode(raw: string): Promise<string | null> {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("{")) return t; // ملف قديم غير مشفّر
  if (!t.startsWith(MAGIC)) throw new Error("ملف البيانات غير صالح");
  const all = fromB64(t.slice(MAGIC.length));
  const salt = all.subarray(0, 16), iv = all.subarray(16, 28), ct = all.subarray(28);
  const key = await deriveKey(salt);
  keyCache = { salt: new Uint8Array(salt), key };
  const zipped = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  return td.decode(await streamBytes(zipped, new DecompressionStream("gzip")));
}

export async function savedHandle(): Promise<any | undefined> {
  try { return await get(HANDLE_KEY, store); } catch { return undefined; }
}
export async function saveHandle(h: any) {
  try { await set(HANDLE_KEY, h, store); } catch { /* ignore */ }
}

const TYPES = [{ description: "بيانات نظام الوجبة", accept: { "application/octet-stream": [".awj", ".json"] } }];

export async function pickExisting() {
  const [h] = await (window as any).showOpenFilePicker({ types: TYPES, excludeAcceptAllOption: false });
  return h;
}
export async function pickNew() {
  return (window as any).showSaveFilePicker({ suggestedName: "alwajbah-data.awj", types: TYPES });
}

export async function ensurePermission(h: any, ask: boolean) {
  const opts = { mode: "readwrite" };
  if ((await h.queryPermission(opts)) === "granted") return true;
  if (!ask) return false;
  return (await h.requestPermission(opts)) === "granted";
}

/** جسر متزامن (يستخدمه المحرك) مبني على نسخة مخزّنة تُحدَّث في الخلفية */
export async function makeBridge(h: any): Promise<FileBridge> {
  const f = await h.getFile();
  let text = await decode(await f.text());
  let realMtime: number = f.lastModified;
  let exposed: number = realMtime;
  let chain: Promise<void> = Promise.resolve();
  let writing = 0;

  const poll = async () => {
    if (writing) return;
    try {
      const nf = await h.getFile();
      if (nf.lastModified !== realMtime && !writing) {
        const nt = await decode(await nf.text());
        realMtime = nf.lastModified;
        if (nt != null) { text = nt; exposed = realMtime; }
      }
    } catch { /* الملف مؤقتاً غير متاح (مزامنة OneDrive) */ }
  };
  window.setInterval(poll, 4000);

  return {
    getPath: () => h.name,
    setPath: () => false,
    choosePath: () => {
      void (async () => {
        try {
          const nh = await pickExisting();
          if (await ensurePermission(nh, true)) { await saveHandle(nh); location.reload(); }
        } catch { /* أُلغي */ }
      })();
      return null;
    },
    stat: () => (text == null ? null : exposed),
    read: () => text,
    write: (t: string) => {
      text = t;
      if (!exposed) exposed = Date.now();
      writing++;
      chain = chain.then(async () => {
        try {
          const enc = await encode(t);
          const w = await h.createWritable();
          await w.write(enc);
          await w.close();
          realMtime = (await h.getFile()).lastModified;
        } catch (e) {
          console.error("تعذّر حفظ ملف البيانات", e);
        } finally { writing--; }
      });
      return true;
    },
  };
}
