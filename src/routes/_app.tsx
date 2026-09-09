import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";
import { AppSidebar, MobileBar } from "@/components/app-sidebar";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { pageByPath } from "@/lib/pages";
import { useSettings } from "@/hooks/use-settings";
import { DEVELOPER_CREDIT } from "@/lib/branding";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const perms = usePagePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  const page = pageByPath(pathname);
  const blocked = !!page && !perms.loading && !perms.isVisible(page.key);


  return (
    <div className="min-h-screen flex bg-background">
      <div data-app-chrome><AppSidebar /></div>
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div data-app-chrome><AppHeader /></div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {blocked ? (
            <div className="max-w-md mx-auto text-center py-20 space-y-3">
              <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
              <h1 className="text-xl font-bold">لا تملك صلاحية الوصول لهذه الصفحة</h1>
              <p className="text-muted-foreground text-sm">تم حجب هذه الصفحة عن حسابك. راجع المشرف العام إذا كنت بحاجة إليها.</p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>

        <footer data-app-chrome className="text-center text-xs text-muted-foreground py-6 border-t mt-8">
          {DEVELOPER_CREDIT}
        </footer>
      </main>
      <div data-app-chrome><MobileBar /></div>
    </div>
  );
}
