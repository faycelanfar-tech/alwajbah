// طباعة النماذج الرسمية: نموذج (1) تعهد طالب — نموذج (2) إثبات واقعة وتحويل لمنسق شؤون الطلاب
export type PledgeKind = "pledge" | "referral";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function printPledge(opts: {
  kind: PledgeKind;
  schoolName: string;
  logoUrl?: string | null;
  studentName: string;
  className?: string | null;
  section?: string | null;
  studentNumber?: string | null;
  date?: string | null;
  period?: string | number | null;
  violation?: string | null;
  severity?: string | number | null;
  occurrence?: number | null;
  description?: string | null;
  teacherName?: string | null;
  action?: string | null;
  supervisorName?: string | null;
}) {
  const o = opts;
  const d = o.date ? new Date(o.date) : new Date();
  const day = isNaN(d.getTime()) ? "" : DAYS[d.getDay()];
  const dateStr = o.date || new Date().toISOString().slice(0, 10);
  const digits = String(o.studentNumber || "").replace(/\s/g, "").slice(0, 11).split("");
  const idCells = Array.from({ length: 11 }, (_, i) => `<td class="dg">${esc(digits[i] || "")}</td>`).join("");
  const actions = String(o.action || "").split(/\s+—\s+|\n/).map((s) => s.trim()).filter(Boolean);
  const title = o.kind === "pledge" ? "تعهد طالب (المشرف الإداري)" : "اثبات واقعة — تحويل إلى منسق شؤون الطلاب";

  const head = `<div class="top">${o.logoUrl ? `<img src="${esc(o.logoUrl)}">` : ""}<div>${esc(o.schoolName)}</div></div>`;

  const form1 = `
<div class="fn">نموذج رقم (1)</div><div class="ft">تعهد طالب (المشرف الإداري)</div>
<table>
<tr><td class="g c" colspan="8"><b>بيانات المخالفة</b></td></tr>
<tr><td class="g">نوع المخالفة</td><td>${esc(o.violation || "")}</td><td class="g">درجة المخالفة</td><td class="c">${esc(o.severity ?? "")}</td>
<td class="g">المخالفة للمرة ( ${esc(o.occurrence ?? "  ")} )</td><td class="g">تاريخ المخالفة</td><td colspan="2">${esc(o.date || "")}</td></tr>
<tr><td class="g">نوع المخالفة</td><td></td><td class="g">درجة المخالفة</td><td></td><td class="g">المخالفة للمرة (    )</td><td class="g">تاريخ المخالفة</td><td colspan="2"></td></tr>
<tr><td class="g">نوع المخالفة</td><td></td><td class="g">درجة المخالفة</td><td></td><td class="g">المخالفة للمرة (    )</td><td class="g">تاريخ المخالفة</td><td colspan="2"></td></tr>
<tr><td colspan="8" class="txt">أتعهد أنا الطالب: <b>${esc(o.studentName)}</b><br>
<div class="c">بالالتزام الكامل بلوائح ونظم المدرسة وعدم تكرار المخالفات التي سبق وقمت بها.<br>
وفي حالة تكرار ذلك سوف تقوم إدارة المدرسة باتخاذ الإجراءات المتبعة حسب اللوائح والقوانين الخاصة بسياسة إدارة سلوك الطلبة 2026 بوزارة التعليم والتعليم العالي.</div></td></tr>
</table>
<table>
<tr><td class="g w">اليوم</td><td>${esc(day)}</td><td class="g w">التاريخ</td><td>${esc(dateStr)}</td></tr>
<tr><td class="g c" colspan="4"><b>بيانات الطالب</b></td></tr>
<tr><td class="g">اسم الطالب</td><td colspan="3">${esc(o.studentName)}</td></tr>
<tr><td class="g">الصف</td><td>${esc(o.className || "")}</td><td class="g">الشعبة</td><td>${esc(o.section || "")}</td></tr>
</table>
<table><tr><td class="g w">الرقم الشخصي</td>${idCells}</tr></table>
<table>
<tr><td class="g c" colspan="2"><b>الإجراءات الوقائية التي تم اتخاذها مع الطالب</b></td></tr>
${[0, 1, 2].map((i) => `<tr class="tall"><td class="n">.${i + 1}</td><td>${esc(actions[i] || "")}</td></tr>`).join("")}
</table>
<table>
<tr><td class="g">توقيع الطالب</td><td class="g">جوال ولي الأمر</td><td class="g">توقيع المشرف${o.supervisorName ? `: ${esc(o.supervisorName)}` : ""}</td></tr>
<tr class="tall"><td></td><td></td><td></td></tr>
<tr><td class="g">منسق شؤون الطلاب</td><td colspan="2"></td></tr>
<tr><td class="g">نائب المدير</td><td colspan="2"></td></tr>
</table>
<p class="note">❖ يتم توقيع الطالب في حال وصول المخالفات لعدد 3 مخالفات وبعدها يتم تحويل الطالب مع الاستمارة واستمارة التحويل لتوقيعها من قبل منسق شؤون الطلبة لاتخاذ الإجراء حسب السياسة ومن ثم للاختصاصي الاجتماعي لدراستها سواء سلوكية أو غياب</p>`;

  const form2 = `
<div class="fn">نموذج رقم (2)</div><div class="ft">اثبات واقعة</div>
<div class="c sub">تحويل الطالب إلى منسق شؤون الطلاب</div>
<table>
<tr><td class="g w">اليوم</td><td>${esc(day)}</td><td class="g w">التاريخ</td><td>${esc(dateStr)}</td></tr>
<tr><td class="g c" colspan="4"><b>بيانات الطالب:</b></td></tr>
<tr><td class="g">اسم الطالب</td><td colspan="3">${esc(o.studentName)}</td></tr>
<tr><td class="g">الصف</td><td>${esc(o.className || "")}</td><td class="g">الشعبة</td><td>${esc(o.section || "")}</td></tr>
</table>
<table><tr><td class="g w">الرقم الشخصي</td>${idCells}</tr></table>
<table>
<tr><td class="g w">ولي الأمر</td><td></td><td class="g w">رقم الهاتف</td><td></td></tr>
<tr><td class="g">نوع الواقعة</td><td>${esc(o.violation || "")}${o.severity ? ` (الدرجة ${esc(o.severity)})` : ""}</td><td class="g">عدد مرات حدوثها</td><td class="c">${esc(o.occurrence ?? "")}</td></tr>
<tr class="big"><td class="g">الموضوع</td><td colspan="3">${esc(o.description || "")}${o.teacherName ? `<div class="sm">المعلم المسجّل: ${esc(o.teacherName)}${o.period ? ` — الحصة ${esc(o.period)}` : ""}</div>` : ""}</td></tr>
<tr class="big"><td class="g">الاجراءات الأولية التي تمت</td><td colspan="3">1/ ${esc(actions[0] || "")}<br><br>2/ ${esc(actions[1] || "")}</td></tr>
</table>
<table>
<tr><td colspan="2" class="c" style="height:50px">إخطار ولي الأمر بالواقعة والإجراء التالي لما بعد إثبات الواقعة : &nbsp; تم (&nbsp;&nbsp;&nbsp;) &nbsp;&nbsp;&nbsp; لم يتم (&nbsp;&nbsp;&nbsp;)</td></tr>
<tr><td class="g c">اسم الطالب</td><td class="g c">التوقيع</td></tr>
<tr class="tall"><td class="c">${esc(o.studentName)}</td><td></td></tr>
</table>
<div class="c"><b><u>توصيات إدارة المدرسة :</u></b></div>
<div class="dots"></div><div class="dots"></div>
<table style="margin-top:18px">
<tr><td class="g c">منسق شؤون الطلاب</td><td class="g c">نائب المدير للشؤون الإدارية والطلابية</td><td class="g c">مدير المدرسة</td></tr>
<tr class="tall"><td></td><td></td><td></td></tr>
<tr class="tall"><td></td><td></td><td></td></tr>
</table>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title} - ${esc(o.studentName)}</title>
<style>
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box}body{font-family:"Times New Roman",Arial,sans-serif;color:#000;margin:0;font-size:14px;font-weight:600}
.top{display:flex;align-items:center;gap:8px;font-size:12px}.top img{width:44px;height:44px;object-fit:contain}
.fn,.ft{text-align:center;font-weight:800;font-size:17px;margin:4px 0}.ft{margin-bottom:8px}.sub{margin:-4px 0 8px}
table{width:100%;border-collapse:collapse;margin:0 0 -1.5px}td{border:1.5px solid #000;padding:6px 8px;vertical-align:middle;word-break:break-word}
.g{background:#f0f0f0}.c{text-align:center}.w{width:18%}.n{width:12%;text-align:center}.dg{text-align:center;width:6.5%}
.tall td{height:40px}.big td{height:90px;vertical-align:top}.big td.g{vertical-align:middle;width:18%}
.txt{line-height:2}.sm{font-size:12px;margin-top:6px;font-weight:400}
.note{font-size:12px;margin-top:6px}.dots{border-bottom:2px dotted #000;margin:22px 10%;}
</style></head><body>${head}${o.kind === "pledge" ? form1 : form2}
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); return; }
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.contentDocument!.open(); f.contentDocument!.write(html.replace(/<script>.*<\/script>/, "")); f.contentDocument!.close();
  setTimeout(() => { f.contentWindow!.print(); setTimeout(() => f.remove(), 2000); }, 400);
}
