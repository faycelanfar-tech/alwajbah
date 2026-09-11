import { LayoutDashboard, Users, GraduationCap, AlertTriangle, FileBarChart, Settings as SettingsIcon, UserCog, Trophy, ClipboardCheck, History, Sparkles, BookOpen } from "lucide-react";
import { READONLY_ROLES } from "@/lib/branding";

const VIEWERS = ["admin", "supervisor", "teacher", ...READONLY_ROLES];

export type AppPage = {
  key: string;
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** الأدوار المسموح لها افتراضياً */
  roles: string[];
  /** لا يمكن حجبها عن المشرف العام */
  locked?: boolean;
};

export const APP_PAGES: AppPage[] = [
  { key: "dashboard", to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: VIEWERS, locked: true },
  { key: "violations", to: "/violations", label: "المخالفات", icon: AlertTriangle, roles: VIEWERS },
  { key: "actions", to: "/actions", label: "الإجراءات", icon: ClipboardCheck, roles: ["admin", "supervisor", ...READONLY_ROLES] },
  { key: "positive", to: "/positive", label: "السلوك الإيجابي", icon: Sparkles, roles: VIEWERS },
  { key: "academic", to: "/academic", label: "التقرير الأكاديمي", icon: BookOpen, roles: VIEWERS },
  { key: "rewards", to: "/rewards", label: "النقاط والمكافآت", icon: Trophy, roles: ["admin", "teacher"] },
  { key: "students", to: "/students", label: "الطلاب", icon: GraduationCap, roles: ["admin", "supervisor", "teacher"] },
  { key: "classes", to: "/classes", label: "الفصول", icon: Users, roles: ["admin"] },
  { key: "teachers", to: "/teachers", label: "المعلمون والحسابات", icon: UserCog, roles: ["admin"] },
  { key: "reports", to: "/reports", label: "التقارير", icon: FileBarChart, roles: VIEWERS },
  { key: "audit", to: "/audit", label: "تتبع العمليات", icon: History, roles: ["admin"] },
  { key: "settings", to: "/settings", label: "الإعدادات", icon: SettingsIcon, roles: ["admin"], locked: true },
];

export const pageByPath = (pathname: string): AppPage | undefined =>
  APP_PAGES.find((p) => pathname === p.to || pathname.startsWith(p.to + "/"));
