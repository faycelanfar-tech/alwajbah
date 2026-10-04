// طباعة تعهد / استمارة مخالفة وإجراء جاهزة بالتواقيع
export type PledgeKind = "pledge" | "referral";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function printPledge(opts: {
  kind: PledgeKind;
  schoolName: string;
  logoUrl?: string | null;
  studentName: string;
  className?: string | null;
  date?: string | null;
  period?: string | number | null;
  violation?: string | null;
  severity?: string | null;
  description?: string | null;
  teacherName?: string | null;
  action?: string | null;
  supervisorName?: string | null;
}) {
  const o = opts;
  const title = o.kind === "pledge" ? "تعهد سلوكي" : "استمارة مخالفة سلوكية وإحالة";
  const today = new Date().toLocaleDateString("ar-EG-u-nu-latn");
  const pledgeText =
    o.kind === "pledge"
      ? `أقر أنا الطالب/ <b>${esc(o.studentName)}</b> بالصف <b>${esc(o.className || "—")}</b> بأنني ارتكبت المخالفة المذكورة أعلاه، وأتعهد بعدم تكرارها والالتزام بالأنظمة واللوائح السلوكية للمدرسة، وفي حال تكرارها أتحمّل الإجراءات المترتبة على ذلك.`
      : `تُحال حالة الطالب/ <b>${esc(o.studentName)}</b> بالصف <b>${esc(o.className || "—")}</b> لاتخاذ الإجراء المناسب وفق اللائحة السلوكية للمدرسة، وقد اطّلع الطالب على المخالفة والإجراء المتخذ.`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title} - ${esc(o.studentName)}</title>
<style>
@page{size:A4 portrait;margin:14mm}
*{box-sizing:border-box}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#111;margin:0;font-size:14px;line-height:1.7}
.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px double #333;padding-bottom:8px}
.head img{width:70px;height:70px;object-fit:contain}.head .c{text-align:center;flex:1}
h1{font-size:20px;margin:4px 0}h2{text-align:center;font-size:22px;margin:16px 0;text-decoration:underline}
table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #444;padding:7px 10px;vertical-align:top;word-break:break-word}
th{background:#f0f0f0;width:22%;text-align:right}
.sec{font-weight:700;margin-top:14px;border-right:4px solid #333;padding-right:8px}
.box{border:1px solid #444;padding:10px;min-height:60px;white-space:pre-wrap}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px}
.sig{border:1px solid #444;padding:10px;text-align:center;min-height:120px}.sig .l{margin-top:50px;border-top:1px dotted #333;padding-top:4px;font-size:12px}
.foot{margin-top:18px;font-size:12px;color:#444;text-align:left}
</style></head><body>
<div class="head"><div style="width:70px">${o.logoUrl ? `<img src="${esc(o.logoUrl)}">` : ""}</div>
<div class="c"><h1>${esc(o.schoolName)}</h1><div>شؤون الطلاب - المتابعة السلوكية</div></div><div style="width:70px;font-size:12px">${today}</div></div>
<h2>${title}</h2>
<div class="sec">أولاً: بيانات الطالب والمخالفة</div>
<table>
<tr><th>اسم الطالب</th><td>${esc(o.studentName)}</td><th>الصف</th><td>${esc(o.className || "—")}</td></tr>
<tr><th>تاريخ المخالفة</th><td>${esc(o.date || "—")}</td><th>الحصة</th><td>${esc(o.period ?? "—")}</td></tr>
<tr><th>المخالفة</th><td colspan="3">${esc(o.violation || "—")}${o.severity ? ` (الدرجة ${esc(o.severity)})` : ""}</td></tr>
${o.description ? `<tr><th>وصف المخالفة</th><td colspan="3">${esc(o.description)}</td></tr>` : ""}
<tr><th>المعلم المسجّل</th><td colspan="3">${esc(o.teacherName || "—")}</td></tr>
</table>
<div class="sec">ثانياً: الإجراء المتخذ</div>
<div class="box">${esc(o.action || "........................................................................................")}</div>
<div class="sec">ثالثاً: ${o.kind === "pledge" ? "نص التعهد" : "الإحالة"}</div>
<div class="box">${pledgeText}</div>
<div class="sigs">
<div class="sig"><b>المعلم المسجّل للمخالفة</b><div>${esc(o.teacherName || "")}</div><div class="l">التوقيع</div></div>
<div class="sig"><b>المشرف الإداري</b><div>${esc(o.supervisorName || "")}</div><div class="l">التوقيع</div></div>
<div class="sig"><b>الطالب</b><div>${esc(o.studentName)}</div><div class="l">التوقيع</div></div>
</div>
<div class="foot">تاريخ الطباعة: ${today}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); return; }
  // بديل عند منع النوافذ المنبثقة
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.contentDocument!.open(); f.contentDocument!.write(html.replace(/<script>.*<\/script>/, "")); f.contentDocument!.close();
  setTimeout(() => { f.contentWindow!.print(); setTimeout(() => f.remove(), 2000); }, 400);
}
