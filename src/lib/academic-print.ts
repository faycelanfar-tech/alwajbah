import { saveAs } from "file-saver";

export const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

/** التقاط الرسوم البيانية المعروضة داخل عنصر معيّن وتحويلها إلى SVG صالح للطباعة */
export function captureCharts(scope: HTMLElement | null): string {
  if (!scope) return "";
  const nodes = Array.from(scope.querySelectorAll<HTMLElement>("[data-print-chart]"));
  return nodes
    .map((node) => {
      const title = node.getAttribute("data-print-chart") || "";
      const svg = node.querySelector("svg.recharts-surface") as SVGSVGElement | null;
      if (!svg) return "";
      const rect = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true) as SVGSVGElement;
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute("viewBox", `0 0 ${rect.width || 400} ${rect.height || 240}`);
      }
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      clone.style.width = "100%";
      clone.style.height = "auto";
      return `<div class="chart"><h3>${esc(title)}</h3>${clone.outerHTML}</div>`;
    })
    .join("");
}

/** حجم الخط وعرض عمود الاسم حسب عدد الأعمدة حتى يتسع الجدول داخل الورقة */
export function fitSizes(columnCount: number) {
  if (columnCount <= 8) return { font: 11, name: 150, pad: 5 };
  if (columnCount <= 12) return { font: 9.5, name: 130, pad: 4 };
  if (columnCount <= 16) return { font: 8.5, name: 115, pad: 3 };
  return { font: 7.5, name: 100, pad: 2 };
}

interface PrintOptions {
  title: string;
  schoolName?: string | null;
  logoUrl?: string | null;
  subtitle?: string;
  columnCount: number;
  chartsHtml?: string;
  legendHtml?: string;
  tableHtml: string;
}

export function buildAcademicPrintHtml(o: PrintOptions, autoPrint: boolean) {
  const s = fitSizes(o.columnCount);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(o.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; margin: 0; }
  .header { text-align: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { margin: 0; color: #1d4ed8; font-size: 20px; }
  .header p { margin: 3px 0; color: #444; font-size: 12px; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 8px 0; }
  .legend span { border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 8px; font-size: 11px; }
  .charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0 14px; page-break-inside: avoid; }
  .chart { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px; page-break-inside: avoid; }
  .chart h3 { margin: 0 0 4px; font-size: 12px; color: #1d4ed8; text-align: center; }
  .chart svg { width: 100% !important; height: auto !important; max-height: 190px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${s.font}px; }
  th, td { border: 1px solid #cbd5e1; padding: ${s.pad}px; text-align: center; word-wrap: break-word; overflow-wrap: anywhere; }
  th { background: #1d4ed8; color: #fff; font-weight: 600; }
  td.name, th.name { text-align: right; width: ${s.name}px; font-weight: 600; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .tag { display: inline-block; padding: 1px 5px; border-radius: 5px; border: 1px solid; font-size: ${s.font - 0.5}px; }
  .footer { margin-top: 12px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head><body>
<div class="header">
  ${o.logoUrl ? `<img src="${esc(o.logoUrl)}" alt="شعار المدرسة" style="height:56px;object-fit:contain;margin-bottom:4px" />` : ""}
  ${o.schoolName ? `<h1>${esc(o.schoolName)}</h1>` : ""}
  <p><b>${esc(o.title)}</b></p>
  ${o.subtitle ? `<p>${esc(o.subtitle)}</p>` : ""}
</div>
${o.legendHtml ? `<div class="legend">${o.legendHtml}</div>` : ""}
${o.chartsHtml ? `<div class="charts">${o.chartsHtml}</div>` : ""}
${o.tableHtml}
<div class="footer">${new Date().toLocaleDateString("ar-EG")}</div>
${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>` : ""}
</body></html>`;
}

/** الطباعة من نافذة about:blank حتى لا يظهر رابط الموقع في تذييل الورقة */
export function printHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function downloadHtml(html: string, filename: string) {
  saveAs(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
}
