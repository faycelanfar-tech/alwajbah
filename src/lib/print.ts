export interface PrintDocOptions {
  schoolName: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  title: string;
  bodyHtml: string;
}

const baseStyles = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Cairo","Tajawal","Segoe UI",Tahoma,sans-serif; direction: rtl; color:#0f172a; margin:0; }
  .head { display:flex; align-items:center; gap:16px; border-bottom:3px solid #1e3a8a; padding-bottom:12px; margin-bottom:20px; }
  .head img { width:70px; height:70px; object-fit:contain; }
  .head h1 { margin:0; font-size:20px; color:#1e3a8a; }
  .head p { margin:2px 0 0; font-size:12px; color:#475569; }
  h2.doc-title { text-align:center; font-size:18px; margin:0 0 18px; padding:8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; color:#1e3a8a; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px; }
  th, td { border:1px solid #cbd5e1; padding:8px 10px; text-align:right; }
  th { background:#f1f5f9; width:28%; font-weight:600; }
  .note { border:1px solid #cbd5e1; border-radius:8px; padding:12px; min-height:70px; font-size:13px; white-space:pre-wrap; }
  .sign { display:flex; justify-content:space-between; gap:24px; margin-top:48px; font-size:13px; }
  .sign div { flex:1; text-align:center; }
  .sign span { display:block; margin-top:44px; border-top:1px dotted #64748b; padding-top:6px; color:#475569; }
  .muted { color:#64748b; font-size:12px; }
`;

export function printDocument({ schoolName, subtitle, logoUrl, title, bodyHtml }: PrintDocOptions) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>${baseStyles}</style></head><body>
    <div class="head">
      ${logoUrl ? `<img src="${logoUrl}" alt="" />` : ""}
      <div>
        <h1>${schoolName || "نظام إدارة المخالفات السلوكية"}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
        <p>التاريخ: ${new Date().toLocaleDateString("ar-EG")}</p>
      </div>
    </div>
    <h2 class="doc-title">${title}</h2>
    ${bodyHtml}
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}

export interface ViolationPrintData {
  studentName?: string;
  className?: string;
  typeName?: string;
  severity?: string;
  date?: string;
  period?: number | null;
  description?: string | null;
  actionTaken?: string | null;
  teacherName?: string;
}

function rows(v: ViolationPrintData) {
  return `
  <table>
    <tr><th>اسم الطالب</th><td>${v.studentName || "—"}</td></tr>
    <tr><th>الصف</th><td>${v.className || "—"}</td></tr>
    <tr><th>نوع المخالفة</th><td>${v.typeName || "—"}</td></tr>
    <tr><th>درجة المخالفة</th><td>${v.severity ? `الدرجة ${v.severity}` : "—"}</td></tr>
    <tr><th>تاريخ المخالفة</th><td>${v.date || "—"}</td></tr>
    <tr><th>الحصة</th><td>${v.period ? `الحصة ${v.period}` : "—"}</td></tr>
    <tr><th>مُسجِّل المخالفة</th><td>${v.teacherName || "—"}</td></tr>
    <tr><th>الإجراء المتخذ</th><td>${v.actionTaken || "لم يُتخذ إجراء بعد"}</td></tr>
  </table>
  <p class="muted">وصف المخالفة:</p>
  <div class="note">${v.description || "—"}</div>`;
}

export function printViolationForm(
  school: { schoolName: string; subtitle?: string | null; logoUrl?: string | null },
  v: ViolationPrintData,
) {
  printDocument({
    ...school,
    title: "استمارة مخالفة سلوكية",
    bodyHtml: `${rows(v)}
      <div class="sign">
        <div>معلم المادة<span></span></div>
        <div>المشرف الإداري<span></span></div>
        <div>مدير المدرسة<span></span></div>
      </div>`,
  });
}

export function printSummonsForm(
  school: { schoolName: string; subtitle?: string | null; logoUrl?: string | null },
  v: ViolationPrintData,
) {
  printDocument({
    ...school,
    title: "استدعاء ولي أمر الطالب",
    bodyHtml: `
      <p style="font-size:14px;line-height:2">
        المكرم ولي أمر الطالب / <strong>${v.studentName || "—"}</strong> &nbsp; حفظه الله<br />
        السلام عليكم ورحمة الله وبركاته، وبعد:<br />
        نأمل من سعادتكم الحضور إلى المدرسة لمناقشة الملاحظات السلوكية المدوّنة أدناه بحق ابنكم،
        وذلك حرصاً على مصلحته التعليمية والتربوية.
      </p>
      ${rows(v)}
      <p class="muted">موعد الحضور:</p>
      <div class="note"></div>
      <div class="sign">
        <div>المشرف الإداري<span></span></div>
        <div>مدير المدرسة<span></span></div>
        <div>توقيع ولي الأمر<span></span></div>
      </div>`,
  });
}
