export const DEVELOPER_CREDIT = "تطوير: ابوجهاد";

export const ACTION_OPTIONS = [
  "تنبيه شفهي",
  "تعهد الطالب",
  "إحالة للمرشد الطلابي",
  "إحالة للإدارة",
  "حسم من درجات السلوك",
  "فصل",
  "تغيير بيئة صفية",
  "تغيير بيئة مدرسية",
] as const;

export const CUSTOM_ACTION = "__custom__";

export type AppRole =
  | "admin"
  | "supervisor"
  | "teacher"
  | "academic_deputy"
  | "admin_deputy"
  | "student_affairs"
  | "social_specialist"
  | "psych_specialist";

export const ROLE_LABELS: Record<string, string> = {
  admin: "المشرف العام",
  supervisor: "المشرف الإداري",
  teacher: "معلم",
  academic_deputy: "النائب الأكاديمي",
  admin_deputy: "النائب الإداري",
  student_affairs: "مشرف شؤون الطلاب",
  social_specialist: "الأخصائي الاجتماعي",
  psych_specialist: "الأخصائي النفسي",
};

/** أدوار الاطلاع والطباعة فقط */
export const READONLY_ROLES: string[] = [
  "academic_deputy",
  "admin_deputy",
  "student_affairs",
  "social_specialist",
  "psych_specialist",
];

export const isReadOnlyRole = (role?: string | null) => !!role && READONLY_ROLES.includes(role);

export const ACADEMIC_LEVELS = ["ممتاز", "جيد", "متوسط", "ضعيف"] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const LEVEL_STYLES: Record<string, string> = {
  "ممتاز": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "جيد": "bg-sky-100 text-sky-700 border-sky-200",
  "متوسط": "bg-amber-100 text-amber-700 border-amber-200",
  "ضعيف": "bg-rose-100 text-rose-700 border-rose-200",
};

/** لوحة ألوان موحّدة للرسوم البيانية في التقارير */
export const CHART_COLORS = [
  "#2563eb", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

/** ألوان مستويات التقرير الأكاديمي */
export const LEVEL_COLORS: Record<string, string> = {
  "ممتاز": "#10b981",
  "جيد": "#2563eb",
  "متوسط": "#f59e0b",
  "ضعيف": "#ef4444",
};

/** ألوان درجات المخالفات */
export const SEVERITY_COLORS: Record<string, string> = {
  "الأولى": "#10b981",
  "الثانية": "#f59e0b",
  "الثالثة": "#f97316",
  "الرابعة": "#ef4444",
};
