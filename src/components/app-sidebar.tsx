import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { LayoutDashboard, Users, GraduationCap, AlertTriangle, FileBarChart, Settings as SettingsIcon, LogOut, UserCog, School } from "lucide-react";
import { cn } from "@/lib/utils";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; roles: string[] }[] = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["admin", "teacher"] },
  { to: "/violations", label: "المخالفات", icon: AlertTriangle, roles: ["admin", "teacher"] },
  { to: "/students", label: "الطلاب", icon: GraduationCap, roles: ["admin", "teacher"] },
  { to: "/classes", label: "الفصول", icon: Users, roles: ["admin"] },
  { to: "/teachers", label: "المعلمون", icon: UserCog, roles: ["admin"] },
  { to: "/reports", label: "التقارير", icon: FileBarChart, roles: ["admin", "teacher"] },
  { to: "/settings", label: "الإعدادات", icon: SettingsIcon, roles: ["admin"] },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-l border-sidebar-border h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="" className="w-10 h-10 rounded-full object-contain bg-white" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground">
              <School className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{settings.school_name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{settings.subtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.filter((n) => !role || n.roles.includes(role)).map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            {(profile?.full_name || profile?.username || "؟").charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile?.full_name || profile?.username}</p>
            <p className="text-xs text-sidebar-foreground/60">{role === "admin" ? "مدير النظام" : "معلم"}</p>
          </div>
        </div>
        <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

export function MobileBar() {
  const { role, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = nav.filter((n) => !role || n.roles.includes(role)).slice(0, 5);
  return (
    <>
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-sidebar border-t border-sidebar-border z-50">
        <div className="flex justify-around">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={cn("flex flex-col items-center gap-1 py-2 px-2 flex-1 text-xs", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="w-5 h-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <button onClick={signOut} aria-label="خروج" className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-full bg-card shadow-card text-destructive">
        <LogOut className="w-4 h-4" />
      </button>
    </>
  );
}
