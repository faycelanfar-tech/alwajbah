// في النسخة المحلية (فتح index.html مباشرة) لا توجد خدمة خادم،
// لذا تُستبدل عمليات إدارة الحسابات برسالة عربية واضحة.
const MESSAGE =
  "هذه العملية تحتاج الاتصال بالنظام عبر الرابط المنشور على الإنترنت، ولا تعمل في النسخة المحلية.";

function unavailable(): never {
  throw new Error(MESSAGE);
}

export const adminResetUserPassword = async (_args?: unknown) => unavailable();
export const requestPasswordReset = async (_args?: unknown) => unavailable();
export const adminCreateUser = async (_args?: unknown) => unavailable();
export const adminDeleteUser = async (_args?: unknown) => unavailable();
