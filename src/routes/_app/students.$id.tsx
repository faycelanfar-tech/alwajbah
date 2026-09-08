import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Printer, TrendingDown, TrendingUp, Award, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useSettings } from "@/hooks/use-settings";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/students/$id")({ component: StudentProfile });

const severityColor: Record<string, string> = {
  "الأولى": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "الثانية": "bg-amber-100 text-amber-700 border-amber-200",
  "الثالثة": "bg-orange-100 text-orange-700 border-orange-200",
  "الرابعة": "bg-rose-100 text-rose-700 border-rose-200",
};

function StudentProfile() {
  const { id } = Route.useParams();
  const { settings, displayName } = useSettings();

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => (await supabase.from("students").select("*, classes(name, grade, stage)").eq("id", id).maybeSingle()).data,
  });

  const { data: points } = useQuery({
    queryKey: ["student-points", id],
    queryFn: async () => (await supabase.from("student_points").select("points").eq("student_id", id).maybeSingle()).data,
  });

  const { data: violations = [] } = useQuery({
    queryKey: ["student-violations", id],
    queryFn: async () => (await supabase.from("violations").select("*, violation_types(name, severity)").eq("student_id", id).order("violation_date", { ascending: false })).data ?? [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["student-transactions", id],
    queryFn: async () => (await supabase.from("point_transactions").select("*").eq("student_id", id).order("created_at", { ascending: true })).data ?? [],
  });

  const { data: positives = [] } = useQuery({
    queryKey: ["student-positives", id],
    queryFn: async () => (await supabase.from("positive_behaviors").select("*, positive_behavior_types(name)").eq("student_id", id).order("behavior_date", { ascending: false })).data ?? [],
  });

  const chartData = useMemo(() => {
    let balance = 50;
    const out: { date: string; points: number }[] = [{ date: "البداية", points: 50 }];
    transactions.forEach((t: any) => {
      balance += t.delta;
      out.push({ date: new Date(t.created_at).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }), points: balance });
    });
    return out;
  }, [transactions]);

  const stats = useMemo(() => {
    const total = violations.length;
    const acted = violations.filter((v: any) => v.action_taken).length;
    const rewards = transactions.filter((t: any) => t.delta > 0).reduce((s: number, t: any) => s + t.delta, 0);
    const pos = positives.length;
    const ratio = pos + total > 0 ? Math.round((pos / (pos + total)) * 100) : 0;
    return { total, acted, rewards, pos, ratio };
  }, [violations, transactions, positives]);

  function printReport() {
    const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const rows = violations.map((v: any) => `
      <tr>
        <td>${esc(v.violation_date)}</td>
        <td>${esc(v.violation_types?.name || "—")}</td>
        <td>${esc(v.violation_types?.severity || "—")}</td>
        <td>${esc(v.description || "—")}</td>
        <td>${esc(v.action_taken || "بانتظار إجراء")}</td>
      </tr>
    `).join("");

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير سلوك الطالب</title>
    <style>
      body { font-family: 'Cairo','Tajawal','Segoe UI',sans-serif; padding: 24px; color: #111; }
      header { display:flex; align-items:center; gap:16px; border-bottom:2px solid #1d4ed8; padding-bottom:12px; margin-bottom:16px;}
      header img { width:60px; height:60px; object-fit:contain;}
      h1 { margin:0; font-size:22px; color:#1d4ed8;}
      .meta { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }
      .meta div { background:#f5f7ff; padding:12px; border-radius:8px;}
      .meta b { display:block; color:#1d4ed8; font-size:12px;}
      .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0; }
      .stats div { text-align:center; padding:10px; border:1px solid #ddd; border-radius:8px;}
      .stats b { display:block; font-size:20px; color:#1d4ed8;}
      table { width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;}
      th,td { border:1px solid #ddd; padding:8px; text-align:right;}
      th { background:#1d4ed8; color:#fff;}
      tr:nth-child(even) { background:#f9fafb;}
      footer { margin-top:24px; text-align:center; color:#666; font-size:11px; border-top:1px solid #ddd; padding-top:8px;}
    </style></head><body>
      <header>
        ${settings.logo_url ? `<img src="${esc(settings.logo_url)}" />` : ""}
        <div>
          <h1>${esc(displayName)}</h1>
          <div>تقرير سلوك الطالب</div>
        </div>
      </header>
      <div class="meta">
        <div><b>اسم الطالب</b>${esc(student?.full_name)}</div>
        <div><b>رقم الطالب</b>${esc(student?.student_number || "—")}</div>
        <div><b>الفصل</b>${esc((student as any)?.classes?.name || "—")}</div>
      </div>
      <div class="stats">
        <div><b>${points?.points ?? 50}</b>الرصيد الحالي</div>
        <div><b>${stats.total}</b>إجمالي المخالفات</div>
        <div><b>${stats.acted}</b>إجراءات منفذة</div>
        <div><b>${stats.rewards}</b>نقاط مكافآت</div>
      </div>
      <h3>سجل المخالفات</h3>
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>الدرجة</th><th>الوصف</th><th>الإجراء</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center">لا توجد مخالفات</td></tr>'}</tbody></table>
      <footer>تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</footer>
      <script>window.onload=()=>window.print()</script>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (!student) {
    return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;
  }

  const balance = points?.points ?? 50;
  const balanceColor = balance >= 40 ? "text-emerald-600" : balance >= 20 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/students"><Button variant="ghost" size="icon"><ArrowRight className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold">{student.full_name}</h1>
            <p className="text-muted-foreground mt-1">
              {(student as any).classes?.name || "بدون فصل"}
              {student.student_number && ` • رقم: ${student.student_number}`}
            </p>
          </div>
        </div>
        <Button onClick={printReport}><Printer className="w-4 h-4 ml-1" /> طباعة تقرير</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-card"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">الرصيد الحالي</p><p className={`text-3xl font-bold mt-1 ${balanceColor}`}>{balance}</p></div>
            {balance >= 40 ? <TrendingUp className="w-8 h-8 text-emerald-500" /> : <TrendingDown className="w-8 h-8 text-rose-500" />}
          </div>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">إجمالي المخالفات</p><p className="text-3xl font-bold mt-1">{stats.total}</p></div>
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-5">
          <div><p className="text-sm text-muted-foreground">إجراءات منفذة</p><p className="text-3xl font-bold mt-1">{stats.acted} / {stats.total}</p></div>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">نقاط المكافآت</p><p className="text-3xl font-bold mt-1 text-emerald-600">+{stats.rewards}</p></div>
            <Award className="w-8 h-8 text-emerald-500" />
          </div>
        </CardContent></Card>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>تطور النقاط</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="points" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <AcademicJourney studentId={id} />

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>سجل المخالفات والإجراءات ({violations.length})</CardTitle></CardHeader>
        <CardContent>
          {violations.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد مخالفات</p>}
          <div className="space-y-2">
            {violations.map((v: any) => (
              <Link key={v.id} to="/violations/$id" params={{ id: v.id }} className="block p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-primary">{v.violation_types?.name || "—"}</span>
                  {v.violation_types?.severity && (
                    <Badge variant="outline" className={severityColor[v.violation_types.severity] || ""}>
                      الدرجة {v.violation_types.severity}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground mr-auto">{v.violation_date}</span>
                </div>
                {v.description && <p className="text-sm text-muted-foreground mt-1">{v.description}</p>}
                {v.action_taken ? (
                  <div className="mt-2 text-sm"><span className="text-emerald-700 font-medium">الإجراء: </span>{v.action_taken}</div>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 mt-2" variant="outline">بانتظار إجراء</Badge>
                )}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AcademicJourney({ studentId }: { studentId: string }) {
  const { levelColor, levels } = useSettings();

  const { data: rows = [] } = useQuery({
    queryKey: ["student-academic", studentId],
    queryFn: async () =>
      (await supabase
        .from("academic_reports")
        .select("month, level, subjects(name)")
        .eq("student_id", studentId)
        .order("month")).data ?? [],
  });

  const months = Array.from(new Set(rows.map((r: any) => String(r.month).slice(0, 7))));
  const subjectNames = Array.from(new Set(rows.map((r: any) => r.subjects?.name).filter(Boolean)));
  const cell = (subject: string, month: string) =>
    rows.find((r: any) => r.subjects?.name === subject && String(r.month).slice(0, 7) === month)?.level;

  const score = (label: string) => {
    const i = levels.findIndex((l) => l.label === label);
    return i === -1 ? 0 : levels.length - i;
  };
  const trend = months.map((m) => {
    const list = rows.filter((r: any) => String(r.month).slice(0, 7) === m);
    const avg = list.length ? list.reduce((s: number, r: any) => s + score(r.level), 0) / list.length : 0;
    return { month: m, avg: Number(avg.toFixed(2)) };
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>المستوى الأكاديمي عبر الأشهر</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">لا يوجد رصد أكاديمي لهذا الطالب</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary">
                    <th className="border p-2 text-right">المادة</th>
                    {months.map((m) => <th key={m} className="border p-2">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {subjectNames.map((s: any) => (
                    <tr key={s}>
                      <td className="border p-2 font-medium">{s}</td>
                      {months.map((m) => {
                        const lvl = cell(s, m);
                        return (
                          <td key={m} className="border p-2 text-center font-medium" style={{ color: lvl ? levelColor(lvl) : undefined }}>
                            {lvl || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">تطور المستوى العام</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, levels.length]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" name="المستوى" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
