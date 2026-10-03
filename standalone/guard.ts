/** طبقة حماية: قفل هوية المدرسة + منع أدوات الفحص */
const SCHOOL = "مدرسة الوجبة الابتدائية";
const DEV = "تطوير: ابوجهاد";
// بصمة الهوية (FNV-1a) — أي تعديل على الاسم أو التوقيع يوقف النظام
const ID_SIG = "__ID_SIG__";

export function identitySig(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

export function identityOk(): boolean {
  return identitySig(SCHOOL + "|" + DEV) === ID_SIG;
}

function lock() {
  document.body.innerHTML =
    '<div dir="rtl" style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Tahoma;background:#fef2f2;color:#b91c1c;font-size:20px;padding:24px;text-align:center">تم إيقاف النظام لأسباب أمنية. أغلق أدوات الفحص ثم أعد فتح الصفحة.</div>';
}

export function installAntiTamper() {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toUpperCase();
    if (k === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(k)) || (e.ctrlKey && k === "U")) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  // فخ التصحيح: عند فتح أدوات المطوّر يتوقف التنفيذ عند debugger فيطول الزمن
  setInterval(() => {
    const t = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - t > 150) lock();
  }, 1500);
}
