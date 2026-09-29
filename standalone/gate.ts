/* eslint-disable @typescript-eslint/no-explicit-any */
/** شاشة التحقق قبل فتح النظام: الترخيص، شبكة المدرسة، ملف البيانات المشترك */
import {
  fsaSupported, savedHandle, saveHandle, pickExisting, pickNew, ensurePermission, makeBridge,
} from "./fsa";
import type { FileBridge } from "./stubs/local-engine";

const ALLOWED_IP = "103.225.74.29";
const EXPIRES = new Date("2027-07-15T23:59:59+03:00").getTime();
const IP_GRACE_MS = 72 * 3600 * 1000;
const K_MAXT = "awj.gate.t";
const K_IPOK = "awj.gate.ip";

const root = () => document.getElementById("root")!;

function screen(title: string, body: string, buttons: { label: string; primary?: boolean; onClick: () => void }[] = [], danger = false) {
  const el = root();
  el.innerHTML = `
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Cairo,Tahoma,sans-serif;background:#f4f6f8;padding:24px" dir="rtl">
    <div style="max-width:520px;width:100%;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:32px;border-top:6px solid ${danger ? "#dc2626" : "#0f766e"}">
      <h1 style="margin:0 0 12px;font-size:22px;color:${danger ? "#b91c1c" : "#0f172a"}">${title}</h1>
      <div style="color:#334155;line-height:1.9;font-size:15px">${body}</div>
      <div id="gate-btns" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px"></div>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">مدرسة الوجبة الابتدائية · تطوير: ابوجهاد</p>
    </div>
  </div>`;
  const box = el.querySelector("#gate-btns")!;
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.style.cssText = `font:inherit;font-family:Cairo,Tahoma,sans-serif;padding:10px 18px;border-radius:10px;cursor:pointer;border:1px solid #0f766e;${b.primary ? "background:#0f766e;color:#fff" : "background:#fff;color:#0f766e"}`;
    btn.onclick = b.onClick;
    box.appendChild(btn);
  }
}

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };

function checkLicense(): boolean {
  const now = Date.now();
  const maxSeen = Number(lsGet(K_MAXT) || 0);
  if (maxSeen && now < maxSeen - 36 * 3600 * 1000) {
    screen("تاريخ الجهاز غير صحيح", "تاريخ هذا الجهاز أقدم من آخر تشغيل للنظام. اضبط التاريخ والوقت الصحيحين ثم أعد فتح النظام.", [{ label: "إعادة المحاولة", primary: true, onClick: () => location.reload() }], true);
    return false;
  }
  lsSet(K_MAXT, String(Math.max(now, maxSeen)));
  if (Math.max(now, maxSeen) > EXPIRES) {
    screen("انتهت صلاحية الترخيص", "انتهى ترخيص استخدام النظام بتاريخ 15 يوليو 2027. يرجى التواصل مع المطوّر لتجديد التفعيل السنوي.", [], true);
    return false;
  }
  return true;
}

async function fetchText(url: string, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.text()).trim();
  } finally { clearTimeout(t); }
}

async function publicIp(): Promise<string | null> {
  for (const u of ["https://api.ipify.org", "https://icanhazip.com", "https://ipv4.icanhazip.com"]) {
    try {
      const ip = await fetchText(u);
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
    } catch { /* جرّب التالي */ }
  }
  return null;
}

async function checkNetwork(): Promise<boolean> {
  screen("جاري التحقق…", "يتم التحقق من شبكة المدرسة.");
  const ip = await publicIp();
  if (ip === ALLOWED_IP) { lsSet(K_IPOK, String(Date.now())); return true; }
  if (ip) {
    screen("تنبيه أمني", "النظام يعمل داخل شبكة المدرسة فقط. هذا الجهاز متصل بشبكة غير مصرّح بها، لذلك تم إيقاف الدخول.", [{ label: "إعادة المحاولة", primary: true, onClick: () => location.reload() }], true);
    return false;
  }
  const ok = Number(lsGet(K_IPOK) || 0);
  if (ok && Date.now() - ok < IP_GRACE_MS) return true;
  screen("تعذّر التحقق من الشبكة", "لا يوجد اتصال بالإنترنت للتحقق من شبكة المدرسة. اتصل بشبكة المدرسة ثم أعد المحاولة.", [{ label: "إعادة المحاولة", primary: true, onClick: () => location.reload() }], true);
  return false;
}

function chooseFile(): Promise<FileBridge | null> {
  return new Promise((resolve) => {
    const finish = async (h: any) => {
      try {
        if (!(await ensurePermission(h, true))) return;
        await saveHandle(h);
        resolve(await makeBridge(h));
      } catch (e: any) {
        screen("تعذّر فتح الملف", `${e?.message ?? "الملف غير صالح"}`, [{ label: "إعادة المحاولة", primary: true, onClick: () => location.reload() }], true);
      }
    };
    const pickOpen = async () => { try { await finish(await pickExisting()); } catch { /* أُلغي */ } };
    const pickCreate = async () => { try { await finish(await pickNew()); } catch { /* أُلغي */ } };
    const localOnly = { label: "العمل على هذا الجهاز فقط", onClick: () => resolve(null) };

    if (!fsaSupported) {
      screen("متصفح غير مدعوم", "لحفظ البيانات في ملف OneDrive المشترك افتح النظام بمتصفح Microsoft Edge أو Google Chrome.", [localOnly], true);
      return;
    }
    void (async () => {
      const saved = await savedHandle();
      if (saved) {
        try {
          if (await ensurePermission(saved, false)) { resolve(await makeBridge(saved)); return; }
        } catch { /* نطلب من جديد */ }
        screen("ملف البيانات المشترك", `اضغط «متابعة» للسماح للنظام بقراءة وحفظ الملف:<br><b dir="ltr">${saved.name}</b>`, [
          { label: "متابعة", primary: true, onClick: () => void finish(saved) },
          { label: "اختيار ملف آخر", onClick: pickOpen },
          localOnly,
        ]);
        return;
      }
      screen("ملف البيانات المشترك", "اختر ملف البيانات الموجود في مجلد OneDrive المشترك (alwajbah-data.awj).<br>إذا كانت هذه أول مرة، أنشئ ملفاً جديداً داخل المجلد المشترك.", [
        { label: "فتح ملف البيانات", primary: true, onClick: pickOpen },
        { label: "إنشاء ملف جديد", onClick: pickCreate },
        localOnly,
      ]);
    })();
  });
}

/** يعيد جسر الملف المشترك (أو null للعمل محلياً) إذا اجتاز الجهاز كل الشروط */
export async function runGate(): Promise<{ ok: boolean; bridge: FileBridge | null }> {
  if (!checkLicense()) return { ok: false, bridge: null };
  if (!(await checkNetwork())) return { ok: false, bridge: null };
  const bridge = await chooseFile();
  root().innerHTML = "";
  return { ok: true, bridge };
}
