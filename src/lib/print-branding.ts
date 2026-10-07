// ترويسة وتذييل الطباعة الموحّدة لكل التقارير.
// القاعدة: تظهر صورة الهيدر والفوتر فقط، ولا يظهر اسم المدرسة أو شعارها
// إلا إذا فعّل المسؤول خيار «إظهار اسم المدرسة والشعار» من الإعدادات.
type S = {
  school_name?: string | null;
  logo_url?: string | null;
  letterhead_url?: string | null;
  footer_url?: string | null;
  print_show_identity?: boolean | null;
} | null | undefined;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const BRAND_CSS = `
.pb-lh{display:block;width:100%;max-height:45mm;object-fit:contain;margin:0 0 8px}
.pb-ft{display:block;width:100%;max-height:30mm;object-fit:contain;margin-top:14px;page-break-inside:avoid}
.pb-id{text-align:center;margin-bottom:6px}.pb-id img{height:56px;object-fit:contain}.pb-id h1{margin:2px 0;font-size:20px;color:#111}
`;

export const showIdentity = (s: S) => !!s?.print_show_identity;

export function brandTop(s: S) {
  const lh = s?.letterhead_url ? `<img class="pb-lh" src="${esc(s.letterhead_url)}" alt="">` : "";
  const id = showIdentity(s)
    ? `<div class="pb-id">${s?.logo_url ? `<img src="${esc(s.logo_url)}" alt="">` : ""}${s?.school_name ? `<h1>${esc(s.school_name)}</h1>` : ""}</div>`
    : "";
  return `<style>${BRAND_CSS}</style>${lh}${id}`;
}

export function brandBottom(s: S) {
  return s?.footer_url ? `<img class="pb-ft" src="${esc(s.footer_url)}" alt="">` : "";
}
