import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/app-header";
import { AppSidebar, MobileBar } from "@/components/app-sidebar";
import { useSettings } from "@/hooks/use-settings";
import { DEVELOPER_CREDIT } from "@/lib/branding";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div data-app-chrome><AppSidebar /></div>
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div data-app-chrome><AppHeader /></div>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
        <footer data-app-chrome className="text-center text-xs text-muted-foreground py-6 border-t mt-8">
          {DEVELOPER_CREDIT}
        </footer>
      </main>
      <div data-app-chrome><MobileBar /></div>
    </div>
  );
}
