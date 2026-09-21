import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { captureCharts, esc, printHtml } from "@/lib/academic-print";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, RotateCcw, Printer, FileSpreadsheet, History, Trash2, Wand2 } from "lucide-react";

export const CRITERIA = [
  { key: "participation", label: "المشاركة", color: "#2563eb" },
  { key: "homework", label: "حل الواجبات", color: "#059669" },
  { key: "tools", label: "إحضار الأدوات", color: "#d97706" },
  { key: "behavior", label: "الالتزام والسلوك", color: "#7c3aed" },
];
const DEFAULT_SCORE = 5;

type Cycle = {
  id: string; teacher_id: string; class_id: string; label: string | null;
  period_type: string; start_date: string; end_date: string | null; is_active: boolean;
  base_score: number; month: string | null;
};
type Entry = {
  id: string; cycle_id: string; student_id: string; delta: number; kind: string;
  criterion: string | null; reason: string | null; note: string | null; period: number | null; created_at: string;
};

const monthStart = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (m?: string | null) =>
  m ? new Date(m).toLocaleDateString("ar-EG", { month: "long", year: "numeric" }) : "—";

export function ParticipationPanel() {
  const { user, role, isOwner, profile } = useAuth() as any;
  const { settings, displayName } = useSettings();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || isOwner;
  const [classId, setClassId] = useState("");
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [archiveId, setArchiveId] = useState("");
  const chartsRef = useRef<HTMLDivElement>(null);
  const thisMonth = monthStart();

  const { data: myClasses = [] } = useQuery({
    queryKey: ["followup-classes", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      if (isAdmin) return (await supabase.from("classes").select("id, name").order("name")).data ?? [];
      const { data } = await supabase.from("teacher_classes").select("class_id, classes(id, name)").eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.classes).filter(Boolean).sort((a: any, b: any) => a.name.localeCompare(b.name, "ar"));
    },
  });

  const selectedClass = (myClasses as any[]).find((c) => c.id === classId);

  const { data: cycle } = useQuery({
    queryKey: ["followup-cycle", user?.id, classId],
    enabled: !!user?.id && !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("participation_cycles")
        .select("*")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId)
        .eq("is_active", true)
        .maybeSingle();
      return (data as Cycle) ?? null;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["followup-students", classId],
    enabled: !!classId,
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["followup-entries", cycle?.id],
    enabled: !!cycle?.id,
    queryFn: async () =>
      ((await supabase.from("participation_entries").select("*").eq("cycle_id", cycle!.id).order("created_at", { ascending: false })).data ?? []) as Entry[],
  });

  const { data: archive = [] } = useQuery({
    queryKey: ["followup-archive", user?.id, classId],
    enabled: !!user?.id && !!classId,
    queryFn: async () =>
      ((await supabase
        .from("participation_cycles")
        .select("*")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId)
        .eq("is_active", false)
        .order("start_date", { ascending: false })
        .limit(24)).data ?? []) as Cycle[],
  });

  const rows = useMemo(() => {
    const list = (students as any[]).map((s) => {
      const mine = (entries as Entry[]).filter((e) => e.student_id === s.id);
      const per: Record<string, number> = {};
      CRITERIA.forEach((c) => {
        per[c.key] = mine.filter((e) => e.criterion === c.key).reduce((a, e) => a + e.delta, 0);
      });
      const other = mine.filter((e) => !e.criterion).reduce((a, e) => a + e.delta, 0);
      const total = CRITERIA.reduce((a, c) => a + per[c.key], 0) + other;
      return {
        id: s.id as string,
        name: s.full_name as string,
        per,
        total,
        hasDefault: mine.some((e) => e.kind === "default"),
        plus: mine.filter((e) => e.delta > 0 && e.kind !== "default").length,
        minus: mine.filter((e) => e.delta < 0).length,
      };
    });
    return list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ar"));
  }, [students, entries]);

  async function ensureCycle() {
    if (cycle?.id) return cycle.id;
    const { data, error } = await supabase
      .from("participation_cycles")
      .insert({ teacher_id: user!.id, class_id: classId, period_type: "monthly", start_date: thisMonth, month: thisMonth, base_score: 0 })
      .select("*")
      .single();
    if (error) throw error;
    qc.setQueryData(["followup-cycle", user?.id, classId], data);
    return (data as Cycle).id;
  }

  const assignDefaults = useMutation({
    mutationFn: async () => {
      const cid = await ensureCycle();
      const targets = rows.filter((r) => !r.hasDefault);
      if (targets.length === 0) throw new Error("تم إسناد الدرجات الافتراضية لجميع الطلاب مسبقاً");
      const payload = targets.flatMap((r) =>
        CRITERIA.map((c) => ({
          cycle_id: cid,
          student_id: r.id,
          delta: DEFAULT_SCORE,
          kind: "default",
          criterion: c.key,
          reason: c.label,
          created_by: user!.id,
        })),
      );
      const { error } = await supabase.from("participation_entries").insert(payload);
      if (error) throw error;
      return targets.length;
    },
    onSuccess: (n) => {
      toast.success(`تم إسناد الدرجات الافتراضية لـ ${n} طالب`);
      qc.invalidateQueries({ queryKey: ["followup-entries"] });
      qc.invalidateQueries({ queryKey: ["followup-cycle"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async ({ studentId, criterion, delta }: { studentId: string; criterion: string; delta: number }) => {
      const cid = await ensureCycle();
      const c = CRITERIA.find((x) => x.key === criterion)!;
      const { error } = await supabase.from("participation_entries").insert({
        cycle_id: cid,
        student_id: studentId,
        delta,
        kind: delta > 0 ? "bonus" : "penalty",
        criterion,
        reason: c.label,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup-entries"] });
      qc.invalidateQueries({ queryKey: ["followup-cycle"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("participation_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["followup-entries"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startMonth = useMutation({
    mutationFn: async (scope: "class" | "all") => {
      const classIds = scope === "all" ? (myClasses as any[]).map((c) => c.id) : [classId];
      const today = new Date().toISOString().slice(0, 10);
      const { error: e1 } = await supabase
        .from("participation_cycles")
        .update({ is_active: false, end_date: today })
        .eq("teacher_id", user!.id)
        .eq("is_active", true)
        .in("class_id", classIds);
      if (e1) throw e1;
      const { error } = await supabase.from("participation_cycles").insert(
        classIds.map((cid) => ({
          teacher_id: user!.id,
          class_id: cid,
          period_type: "monthly",
          start_date: thisMonth,
          month: thisMonth,
          base_score: 0,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ تقرير الشهر السابق وبدء شهر جديد");
      setResetOpen(false);
      qc.invalidateQueries({ queryKey: ["followup-cycle"] });
      qc.invalidateQueries({ queryKey: ["followup-entries"] });
      qc.invalidateQueries({ queryKey: ["followup-archive"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const teacherName = profile?.full_name || user?.email?.split("@")[0] || "";
  const currentMonthLabel = monthLabel(cycle?.month ?? thisMonth);
  const chartData = rows.slice(0, 15).map((r) => ({ name: r.name, الدرجة: r.total }));
  const criteriaTotals = CRITERIA.map((c) => ({
    name: c.label,
    value: Math.max(0, rows.reduce((a, r) => a + r.per[c.key], 0)),
    color: c.color,
  }));

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r, i) => ({
        الترتيب: i + 1,
        الطالب: r.name,
        ...Object.fromEntries(CRITERIA.map((c) => [c.label, r.per[c.key]])),
        المجموع: r.total,
        "إضافات +": r.plus,
        "خصومات −": r.minus,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "متابعة الطلاب");
    XLSX.writeFile(wb, `متابعة_الطلاب_${selectedClass?.name ?? ""}_${currentMonthLabel}.xlsx`);
  }

  function buildReport(reportRows: typeof rows, label: string, charts: string) {
    const best = reportRows.slice(0, 3);
    const least = [...reportRows].reverse().slice(0, 3);
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>تقرير متابعة الطلاب</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: "Segoe UI", Tahoma, sans-serif; color:#111; }
header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #1d4ed8; padding-bottom:8px; margin-bottom:14px; }
header img { height:56px; }
h1 { font-size:18px; margin:0; }
.meta { font-size:12px; color:#555; margin-top:4px; }
table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:12px; }
th, td { border:1px solid #cbd5e1; padding:5px 7px; text-align:center; }
th { background:#eff6ff; }
td.name { text-align:right; font-weight:600; }
tr.top1 td { background:#fef9c3; font-weight:700; }
tr.top2 td { background:#f1f5f9; font-weight:700; }
tr.top3 td { background:#fff7ed; font-weight:700; }
.boxes { display:flex; gap:10px; margin:10px 0; }
.box { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:8px; font-size:12px; }
.box h3 { margin:0 0 6px; font-size:13px; color:#1d4ed8; }
.charts { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0; }
.chart { border:1px solid #e5e7eb; border-radius:8px; padding:6px; }
.chart h3 { margin:0 0 4px; font-size:12px; text-align:center; color:#1d4ed8; }
.chart svg { width:100% !important; height:auto !important; max-height:220px; }
</style></head><body>
<header>${settings.logo_url ? `<img src="${esc(settings.logo_url)}" />` : ""}
<div><h1>${esc(displayName)} — تقرير متابعة الطلاب</h1>
<div class="meta">المعلم: ${esc(teacherName)} · الشعبة: ${esc(selectedClass?.name ?? "")} · الشهر: ${esc(label)} · تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")}</div></div>
</header>
${charts ? `<div class="charts">${charts}</div>` : ""}
<div class="boxes">
  <div class="box"><h3>الأفضل مشاركةً والتزاماً (للتكريم)</h3>${best.map((r, i) => `${i + 1}. ${esc(r.name)} — ${r.total}`).join("<br/>")}</div>
  <div class="box"><h3>الأقل مشاركةً (بحاجة إلى تحفيز)</h3>${least.map((r, i) => `${i + 1}. ${esc(r.name)} — ${r.total}`).join("<br/>")}</div>
</div>
<table><thead><tr><th>#</th><th>الطالب</th>${CRITERIA.map((c) => `<th>${c.label}</th>`).join("")}<th>المجموع</th></tr></thead><tbody>
${reportRows
  .map(
    (r, i) =>
      `<tr class="${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}"><td>${i + 1}</td><td class="name">${esc(r.name)}</td>${CRITERIA.map((c) => `<td>${r.per[c.key]}</td>`).join("")}<td>${r.total}</td></tr>`,
  )
  .join("")}
</tbody></table>
<script>window.onload=()=>{setTimeout(()=>window.print(),350)}<\/script>
</body></html>`;
  }

  function printReport() {
    printHtml(buildReport(rows, currentMonthLabel, captureCharts(chartsRef.current)));
  }

  const printArchive = useMutation({
    mutationFn: async (cycleId: string) => {
      const c = (archive as Cycle[]).find((x) => x.id === cycleId);
      const { data } = await supabase.from("participation_entries").select("*").eq("cycle_id", cycleId);
      const list = (data ?? []) as Entry[];
      const reportRows = (students as any[])
        .map((s) => {
          const mine = list.filter((e) => e.student_id === s.id);
          const per: Record<string, number> = {};
          CRITERIA.forEach((cr) => (per[cr.key] = mine.filter((e) => e.criterion === cr.key).reduce((a, e) => a + e.delta, 0)));
          return {
            id: s.id, name: s.full_name as string, per,
            total: CRITERIA.reduce((a, cr) => a + per[cr.key], 0) + mine.filter((e) => !e.criterion).reduce((a, e) => a + e.delta, 0),
            hasDefault: true, plus: 0, minus: 0,
          };
        })
        .sort((a, b) => b.total - a.total);
      printHtml(buildReport(reportRows as any, monthLabel(c?.month ?? c?.start_date), ""));
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>متابعة الطلاب — {currentMonthLabel}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-52"><SelectValue placeholder="اختر الشعبة" /></SelectTrigger>
                <SelectContent>
                  {(myClasses as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button disabled={!classId || rows.length === 0 || assignDefaults.isPending} onClick={() => assignDefaults.mutate()}>
                <Wand2 className="w-4 h-4 ml-1" /> إسناد الدرجات الافتراضية ({DEFAULT_SCORE} لكل بند)
              </Button>
              <Button variant="outline" disabled={!classId} onClick={() => setResetOpen(true)}>
                <RotateCcw className="w-4 h-4 ml-1" /> بدء شهر جديد
              </Button>
              <Button variant="outline" disabled={!classId || rows.length === 0} onClick={printReport}>
                <Printer className="w-4 h-4 ml-1" /> طباعة التقرير
              </Button>
              <Button variant="outline" disabled={!classId || rows.length === 0} onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> إكسل
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!classId && <p className="text-muted-foreground text-sm">اختر إحدى شعبك المسندة لعرض الطلاب ومتابعتهم.</p>}
          {classId && (
            <>
              <p className="text-sm text-muted-foreground">
                كل مشاركة أو فعل إيجابي +1، وكل تصرف سلبي −1. تُحفظ درجات الشهر في النظام عند بدء شهر جديد ويمكن طباعتها لاحقاً.
              </p>

              {rows.length > 0 && (
                <div ref={chartsRef} className="grid gap-4 md:grid-cols-2">
                  <div className="border rounded-lg p-3" data-print-chart="درجات المتابعة حسب الطالب">
                    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 26)}>
                      <BarChart data={chartData} layout="vertical" margin={{ right: 12, left: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="الدرجة" radius={[0, 4, 4, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CRITERIA[i % CRITERIA.length].color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border rounded-lg p-3" data-print-chart="توزيع الدرجات حسب البنود">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={criteriaTotals} dataKey="value" nameKey="name" outerRadius={90} label>
                          {criteriaTotals.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      {CRITERIA.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
                      <TableHead className="text-center">المجموع</TableHead>
                      <TableHead className="text-center">السجل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={CRITERIA.length + 4} className="text-center text-muted-foreground py-8">لا يوجد طلاب في هذه الشعبة</TableCell></TableRow>
                    )}
                    {rows.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium whitespace-normal break-words">{r.name}</TableCell>
                        {CRITERIA.map((c) => (
                          <TableCell key={c.key}>
                            <div className="flex items-center justify-center gap-1">
                              <Button size="icon" variant="outline" className="h-7 w-7" aria-label={`خصم ${c.label}`}
                                onClick={() => adjust.mutate({ studentId: r.id, criterion: c.key, delta: -1 })}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-7 text-center text-sm font-semibold">{r.per[c.key]}</span>
                              <Button size="icon" variant="outline" className="h-7 w-7" aria-label={`إضافة ${c.label}`}
                                onClick={() => adjust.mutate({ studentId: r.id, criterion: c.key, delta: 1 })}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">{r.total}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" onClick={() => setHistoryFor({ id: r.id, name: r.name })} aria-label="السجل">
                            <History className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {archive.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">تقارير الأشهر السابقة:</span>
                  <Select value={archiveId} onValueChange={setArchiveId}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="اختر الشهر" /></SelectTrigger>
                    <SelectContent>
                      {(archive as Cycle[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{monthLabel(c.month ?? c.start_date)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!archiveId || printArchive.isPending} onClick={() => printArchive.mutate(archiveId)}>
                    <Printer className="w-4 h-4 ml-1" /> طباعة تقرير الشهر
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>سجل متابعة {historyFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(entries as Entry[]).filter((e) => e.student_id === historyFor?.id).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد حركات في هذا الشهر</p>
            )}
            {(entries as Entry[])
              .filter((e) => e.student_id === historyFor?.id)
              .map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 border rounded-md p-2">
                  <div className="text-sm">
                    <span className={e.delta > 0 ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </span>{" "}
                    {e.reason || "متابعة"}
                    {e.kind === "default" ? " (درجة افتراضية)" : ""}
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => delEntry.mutate(e.id)} aria-label="حذف">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>بدء شهر جديد</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            يُحفظ تقرير الشهر الحالي في النظام (يمكن طباعته لاحقاً) وتبدأ درجات جميع الطلاب من الصفر.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={startMonth.isPending} onClick={() => startMonth.mutate("class")}>
              للشعبة الحالية فقط
            </Button>
            <Button disabled={startMonth.isPending} onClick={() => startMonth.mutate("all")}>لجميع شعبي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
