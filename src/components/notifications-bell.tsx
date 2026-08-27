import { useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () =>
      ((await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)).data ?? []) as Notif[],
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">الإشعارات</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
          >
            <CheckCheck className="w-3.5 h-3.5 ml-1" /> تعليم الكل كمقروء
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا توجد إشعارات</p>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                markRead([n.id]);
                if (n.link) navigate({ to: n.link as "/actions" });
              }}
              className={cn(
                "w-full text-right p-3 border-b last:border-0 hover:bg-accent/50 transition-colors",
                !n.read && "bg-accent/30",
              )}
            >
              <p className="text-sm font-medium flex items-center gap-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                <span className="break-words">{n.title}</span>
              </p>
              {n.body && <p className="text-xs text-muted-foreground mt-1 break-words">{n.body}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-EG")}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
