import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { profile } = useAuth();
  const { displayName } = useSettings();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, classes, violations, recent] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*", { count: "exact", head: true }),
        supabase.from("violations").select("*", { count: "exact", head: true }),
        supabase.from("violations").select("id, violation_date, description, students(full_name), violation_types(name, severity)").order("created_at", { ascending: false }).limit(5),
      ]);
      const monthStart = new Date(); monthStart.setDate(1);
      const { count: monthCount } = await supabase.from("violations").select("*", { count: "exact", head: true }).gte("violation_date", monthStart.toISOString().slice(0, 10));
      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        violations: violations.count ?? 0,
        monthly: monthCount ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  const cards = [
    { label: "إجمالي الطلاب", value: stats?.students, icon: GraduationCap, color: "from-blue-500 to-blue-600" },
    { label: "عدد الفصول", value: stats?.classes, icon: Users, color: "from-emerald-500 to-emerald-600" },
    { label: "إجمالي المخالفات", value: stats?.violations, icon: AlertTriangle, color: "from-amber-500 to-orange-500" },
    { label: "مخالفات هذا الشهر", value: stats?.monthly, icon: TrendingUp, color: "from-rose-500 to-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">أهلاً، {profile?.full_name || profile?.username} 👋</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على نشاط {displayName}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden border-0 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-3xl font-bold mt-2">{c.value ?? "—"}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${c.color} text-white shadow-elegant`}>
                  <c.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>آخر المخالفات</CardTitle>
          <Link to="/violations" className="text-sm text-primary hover:underline">عرض الكل</Link>
        </CardHeader>
        <CardContent>
          {stats?.recent.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد مخالفات بعد</p>}
          <div className="space-y-2">
            {stats?.recent.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="font-medium">{v.students?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{v.violation_types?.name || v.description}</p>
                </div>
                <span className="text-xs text-muted-foreground">{v.violation_date}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
