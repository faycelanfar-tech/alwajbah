import { School } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_LABELS } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { settings, displayName } = useSettings();
  const { role, profile } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-card/85 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 md:px-8 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={`شعار ${displayName}`} className="w-11 h-11 rounded-full object-contain bg-background border" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center">
              <School className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{settings.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {profile && (
            <div className="hidden sm:block text-left ml-2 min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name || profile.username}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[role ?? ""] ?? "مستخدم"}</p>
            </div>
          )}
          <NotificationsBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

