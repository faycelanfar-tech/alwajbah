import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

type Period = "week" | "month" | "term";

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "term", label: "الفصل الدراسي" },
];

function periodStart(p: Period) {
  const d = new Date();
  if (p === "week") d.setDate(d.getDate() - 6);
  else if (p === "month") d.setDate(d.getDate() - 29);
  else d.setMonth(d.getMonth() - 4);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const { profile, role, user } = useAuth();
  const { displayName } = useSettings();
  const [period, setPeriod] = useState<Period>("month");
  const isTeacher = role === "teacher";

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

  const { data: chartRows = [] } = useQuery({
    queryKey: ["dashboard-charts", period],
    enabled: !isTeacher,
    queryFn: async () => {
      const { data } = await supabase
        .from("violations")
        .select("id, violation_date, violation_types(name), students(classes(name))")
        .gte("violation_date", periodStart(period))
        .order("violation_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: myViolations = [] } = useQuery({
    queryKey: ["my-violations", user?.id],
    enabled: isTeacher && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("violations")
        .select("id, violation_date, action_taken, description, students(full_name, classes(name)), violation_types(name, severity)")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const byType = countBy(chartRows.map((v: any) => v.violation_types?.name || "غير محدد")).slice(0, 8);
  const byClass = countBy(chartRows.map((v: any) => v.students?.classes?.name || "بدون فصل")).slice(0, 8);
  const byDate = Object.entries(
    chartRows.reduce((acc: Record<string, number>, v: any) => {
      acc[v.violation_date] = (acc[v.violation_date] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: value as number }));

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

      {!isTeacher && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">الفترة:</span>
            {PERIODS.map((p) => (
              <Button key={p.key} size="sm" variant={period === p.key ? "default" : "outline"} onClick={() => setPeriod(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="أكثر المخالفات تكراراً">
              {byType.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byType} layout="vertical" margin={{ right: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="عدد المخالفات" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="الفصول الأكثر تسجيلاً للمخالفات">
              {byClass.length === 0 ? <NoData /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byClass} margin={{ right: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="عدد المخالفات" fill="hsl(var(--chart-2, var(--primary)))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard title="التوزيع الزمني للمخالفات">
            {byDate.length === 0 ? <NoData /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={byDate} margin={{ right: 12, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" name="عدد المخالفات" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}

      {isTeacher && (
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>مخالفاتي وحالتها</CardTitle>
            <Link to="/violations" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {myViolations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لم تسجّل أي مخالفة بعد</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-right py-2 font-medium">الطالب</th>
                    <th className="text-right py-2 font-medium">الفصل</th>
                    <th className="text-right py-2 font-medium">المخالفة</th>
                    <th className="text-right py-2 font-medium">التاريخ</th>
                    <th className="text-right py-2 font-medium">الحالة</th>
                    <th className="text-right py-2 font-medium">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {myViolations.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0 align-top">
                      <td className="py-2 font-medium break-words">{v.students?.full_name}</td>
                      <td className="py-2">{v.students?.classes?.name || "—"}</td>
                      <td className="py-2 break-words max-w-[220px] whitespace-normal">{v.violation_types?.name || v.description || "—"}</td>
                      <td className="py-2 whitespace-nowrap">{v.violation_date}</td>
                      <td className="py-2">
                        {v.action_taken ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">تم اتخاذ إجراء</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">قيد المراجعة</Badge>
                        )}
                      </td>
                      <td className="py-2 break-words max-w-[220px] whitespace-normal text-muted-foreground">{v.action_taken || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

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
                <div className="min-w-0">
                  <p className="font-medium">{v.students?.full_name}</p>
                  <p className="text-sm text-muted-foreground break-words">{v.violation_types?.name || v.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{v.violation_date}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

function countBy(values: string[]) {
  const map: Record<string, number> = {};
  values.forEach((v) => { map[v] = (map[v] || 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function NoData() {
  return <p className="text-center text-muted-foreground py-12 text-sm">لا توجد بيانات في هذه الفترة</p>;
}
