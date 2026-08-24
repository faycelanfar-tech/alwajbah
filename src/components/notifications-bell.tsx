import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, TrendingDown } from "lucide-react";

export function NotificationsBell() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () =>
      (await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)).data ?? [],
  });

  const { data: lowPoints = [] } = useQuery({
    queryKey: ["low-points"],
    enabled: role === "admin",
    queryFn: async () =>
      (await supabase
        .from("student_points")
        .select("points, students(id, full_name)")
        .lte("points", 10)
        .order("points")
        .limit(10)).data ?? [],
  });

  const unread = items.filter((n: any) => !n.read);

  const markAll = useMutation({
    mutationFn: async () => {
      const ids = unread.map((n: any) => n.id);
      if (!ids.length) return;
      await supabase.from("notifications").update({ read: true }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const count = unread.length + lowPoints.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="التنبيهات">
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">التنبيهات</p>
          {unread.length > 0 && (
            <button onClick={() => markAll.mutate()} className="text-xs text-primary flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" /> تحديد الكل كمقروء
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {lowPoints.map((p: any) => (
            <Link
              key={p.students?.id}
              to="/rewards"
              className="flex gap-2 p-3 text-sm hover:bg-secondary/60"
            >
              <TrendingDown className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">رصيد نقاط منخفض</p>
                <p className="text-xs text-muted-foreground">
                  {p.students?.full_name} — {p.points} نقطة
                </p>
              </div>
            </Link>
          ))}
          {items.map((n: any) => (
            <Link
              key={n.id}
              to={(n.link || "/dashboard") as "/dashboard"}
              className={`block p-3 text-sm hover:bg-secondary/60 ${n.read ? "opacity-60" : ""}`}
            >
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString("ar-EG")}
              </p>
            </Link>
          ))}
          {items.length === 0 && lowPoints.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
