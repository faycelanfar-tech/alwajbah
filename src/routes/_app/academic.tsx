import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ACADEMIC_LEVELS, LEVEL_STYLES, CHART_COLORS, isReadOnlyRole } from "@/lib/branding";
import { buildAcademicPrintHtml, captureCharts, downloadHtml, printHtml, esc } from "@/lib/academic-print";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PasteScoresDialog } from "@/components/paste-scores-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Printer, Save, Loader2, Download } from "lucide-react";

export const Route = createFileRoute("/_app/academic")({
  component: AcademicPage,
  head: () => ({
    meta: [
      { title: "التقرير الأكاديمي الشهري | نظام المتابعة المدرسية" },
      { name: "description", content: "رصد المستوى الأكاديمي الشهري لكل طالب في كل مادة، مع تعبئة سريعة للصف وتقرير شهري قابل للطباعة." },
      { property: "og:title", content: "التقرير الأكاديمي الشهري" },
      { property: "og:description", content: "رصد وطباعة المستوى الأكاديمي الشهري للطلاب حسب المادة والصف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
};

function AcademicPage() {
  const { user, role } = useAuth();
  const { settings, academicLevelFor } = useSettings();
  const qc = useQueryClient();
  const readOnly = isReadOnlyRole(role) || role === "supervisor";

  const [month, setMonth] = useState(monthKey(new Date()));
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, string>>({});

  const monthDate = `${month}-01`;

  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });
  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("sort_order")).data ?? [],
  });

  // المعلم يرى مادته وصفوفه فقط
  const isTeacher = role === "teacher";
  const { data: myAssign } = useQuery({
    queryKey: ["my-assignments", user?.id],
    enabled: !!user?.id && isTeacher,
    queryFn: async () => {
      const [s, c] = await Promise.all([
        supabase.from("teacher_subjects").select("subject_id").eq("user_id", user!.id),
        supabase.from("teacher_classes").select("class_id").eq("user_id", user!.id),
      ]);
      return {
        subjectIds: (s.data ?? []).map((r: any) => r.subject_id),
        classIds: (c.data ?? []).map((r: any) => r.class_id),
      };
    },
  });

  // المعلم مقيَّد دائماً بمواده وصفوفه المسندة، بينما المشرف العام والنائب الأكاديمي يرون الكل
  const subjects = isTeacher
    ? (myAssign ? allSubjects.filter((s: any) => myAssign.subjectIds.includes(s.id)) : [])
    : allSubjects;
  const classes = isTeacher
    ? (myAssign ? allClasses.filter((c: any) => myAssign.classIds.includes(c.id)) : [])
    : allClasses;

  // اختيار تلقائي عند وجود خيار واحد للمعلم
  useEffect(() => {
    if (!isTeacher) return;
    if (!subjectId && subjects.length === 1) setSubjectId(subjects[0].id);
    if (!classId && classes.length === 1) setClassId(classes[0].id);
  }, [isTeacher, subjects, classes, subjectId, classId]);
  const { data: students = [] } = useQuery({
    queryKey: ["students-class", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });

  const { data: existing = [], isFetching } = useQuery({
    queryKey: ["academic", month, classId, subjectId],
    enabled: !!classId && !!subjectId,
    queryFn: async () => {
      const ids = students.map((s: any) => s.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("academic_reports").select("*").eq("month", monthDate).eq("subject_id", subjectId).in("student_id", ids);
      const map: Record<string, string> = {};
      const sc: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        map[r.student_id] = r.level;
        if (r.score !== null && r.score !== undefined) sc[r.student_id] = String(r.score);
      });
      setLevels(map);
      setScores(sc);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(levels)
        .filter(([, lvl]) => !!lvl)
        .map(([student_id, level]) => ({
          student_id,
          subject_id: subjectId,
          month: monthDate,
          level,
          score: scores[student_id]?.trim() ? Number(scores[student_id]) : null,
          created_by: user?.id,
        }));
      if (!rows.length) throw new Error("لم يتم تحديد أي مستوى");
      const { error } = await supabase.from("academic_reports").upsert(rows as any, { onConflict: "student_id,subject_id,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التقرير الأكاديمي");
      qc.invalidateQueries({ queryKey: ["academic"] });
      qc.invalidateQueries({ queryKey: ["academic-monthly"] });
      qc.invalidateQueries({ queryKey: ["combined-monthly"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAll = (lvl: string) => {
    const next: Record<string, string> = {};
    students.forEach((s: any) => { next[s.id] = lvl; });
    setLevels(next);
  };

  const setScore = (studentId: string, value: string) => {
    setScores((prev) => ({ ...prev, [studentId]: value }));
    const derived = academicLevelFor(value.trim() === "" ? null : Number(value));
    if (derived) setLevels((prev) => ({ ...prev, [studentId]: derived }));
  };

  const applyImportedScores = (list: { studentId: string; score: number }[]) => {
    setScores((prev) => {
      const next = { ...prev };
      list.forEach((i) => { next[i.studentId] = String(i.score); });
      return next;
    });
    setLevels((prev) => {
      const next = { ...prev };
      list.forEach((i) => {
        const derived = academicLevelFor(i.score);
        if (derived) next[i.studentId] = derived;
      });
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="text-3xl font-bold">التقرير الأكاديمي</h1>
          <p className="text-muted-foreground mt-1">رصد المستوى الأكاديمي الشهري لكل طالب في كل مادة</p>
        </div>
      </div>

      <Tabs defaultValue="entry">
        <TabsList className="print:hidden">
          <TabsTrigger value="entry">الرصد</TabsTrigger>
          <TabsTrigger value="report">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="combined">التقرير الموحّد</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="mt-4 space-y-4">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle>اختيار الشهر والصف والمادة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>الصف</Label>
                <Select value={classId} onValueChange={(v) => { setClassId(v); setLevels({}); setScores({}); }}>
                  <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المادة</Label>
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLevels({}); setScores({}); }}>
                  <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                  <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {classId && subjectId && (
            <Card className="border-0 shadow-card">
              <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle>الطلاب ({students.length})</CardTitle>
                {!readOnly && (
                  <div className="flex gap-2 flex-wrap">
                    <PasteScoresDialog students={students} onApply={applyImportedScores} />
                    <span className="text-sm text-muted-foreground self-center">تعيين الكل:</span>
                    {ACADEMIC_LEVELS.map((l) => (
                      <Button key={l} size="sm" variant="outline" onClick={() => setAll(l)}>{l}</Button>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {isFetching && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                <p className="text-xs text-muted-foreground">
                  يمكنك إدخال درجة الطالب فيُحدَّد المستوى تلقائياً حسب نظام التصحيح في الإعدادات، أو اختيار المستوى يدوياً.
                </p>
                {students.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border flex-wrap">
                    <span className="font-medium">{s.full_name}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="الدرجة"
                        className="w-24 h-9"
                        disabled={readOnly}
                        value={scores[s.id] ?? ""}
                        onChange={(e) => setScore(s.id, e.target.value)}
                      />
                      <div className="flex gap-1 flex-wrap">
                        {ACADEMIC_LEVELS.map((l) => (
                          <Button
                            key={l}
                            size="sm"
                            disabled={readOnly}
                            variant={levels[s.id] === l ? "default" : "outline"}
                            onClick={() => setLevels({ ...levels, [s.id]: l })}
                          >{l}</Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {students.length === 0 && <p className="text-center text-muted-foreground py-6">لا يوجد طلاب في هذا الصف</p>}
                {!readOnly && students.length > 0 && (
                  <Button className="w-full mt-2" size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                    حفظ التقرير
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <MonthlyReport month={month} setMonth={setMonth} classId={classId} setClassId={setClassId} classes={classes} subjects={subjects} settings={settings} />
        </TabsContent>

        <TabsContent value="combined" className="mt-4">
          <CombinedReport month={month} setMonth={setMonth} classId={classId} setClassId={setClassId} classes={classes} subjects={subjects} settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const LEVEL_SCORE: Record<string, number> = { "ممتاز": 4, "جيد": 3, "متوسط": 2, "ضعيف": 1 };

function LevelPie({ title, entries, color }: { title: string; entries: Record<string, number>; color: (l: string) => string }) {
  const data = Object.entries(entries)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  return (
    <div className="border rounded-lg p-3" data-print-chart={title}>
      <p className="font-medium text-sm text-center mb-1">{title}</p>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={70} label={(e: any) => `${e.name}: ${e.value}`}>
              {data.map((d) => <Cell key={d.name} fill={color(d.name)} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SubjectBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="border rounded-lg p-3" data-print-chart="متوسط المستوى حسب المادة">
      <p className="font-medium text-sm text-center mb-1">متوسط المستوى حسب المادة</p>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">لا توجد بيانات</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 4]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function tag(label: string, color: string, extra = "") {
  return `<span class="tag" style="color:${color};border-color:${color};background:${color}1a">${escHtml(label)}${extra}</span>`;
}
const escHtml = esc;

function MonthlyReport({ month, setMonth, classId, setClassId, classes, subjects, settings }: any) {
  const monthDate = `${month}-01`;
  const { start, end } = monthRange(month);
  const { behaviorLevelFor, behaviorLevels, levelColor } = useSettings();
  const areaRef = useRef<HTMLDivElement>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students-class-report", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["academic-monthly", month, classId, students.length],
    enabled: !!classId && students.length > 0,
    queryFn: async () => {
      const ids = students.map((s: any) => s.id);
      const { data } = await supabase.from("academic_reports").select("*").eq("month", monthDate).in("student_id", ids);
      return data ?? [];
    },
  });
  const { data: violations = [] } = useQuery({
    queryKey: ["academic-monthly-violations", month, classId, students.length],
    enabled: !!classId && students.length > 0,
    queryFn: async () => {
      const ids = students.map((s: any) => s.id);
      const { data } = await supabase.from("violations").select("id, student_id").gte("violation_date", start).lte("violation_date", end).in("student_id", ids);
      return data ?? [];
    },
  });

  const grid = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    rows.forEach((r: any) => {
      map[r.student_id] = map[r.student_id] || {};
      map[r.student_id][r.subject_id] = r.level;
    });
    return map;
  }, [rows]);

  const vCounts = useMemo(() => {
    const c: Record<string, number> = {};
    violations.forEach((v: any) => { c[v.student_id] = (c[v.student_id] ?? 0) + 1; });
    return c;
  }, [violations]);

  const summary = useMemo(() => {
    const s: Record<string, number> = {};
    ACADEMIC_LEVELS.forEach((l) => { s[l] = 0; });
    rows.forEach((r: any) => { if (s[r.level] !== undefined) s[r.level]++; });
    return s;
  }, [rows]);

  const behaviorSummary = useMemo(() => {
    const s: Record<string, number> = {};
    behaviorLevels.forEach((l) => { s[l.label] = 0; });
    students.forEach((st: any) => {
      const b = behaviorLevelFor(vCounts[st.id] ?? 0);
      if (b) s[b.label] = (s[b.label] ?? 0) + 1;
    });
    return s;
  }, [students, vCounts, behaviorLevels, behaviorLevelFor]);

  const subjectAverages = useMemo(() =>
    subjects.map((sub: any) => {
      const list = rows.filter((r: any) => r.subject_id === sub.id).map((r: any) => LEVEL_SCORE[r.level] ?? 0).filter(Boolean);
      return { name: sub.name, value: list.length ? Number((list.reduce((a: number, b: number) => a + b, 0) / list.length).toFixed(2)) : 0 };
    }).filter((d: any) => d.value > 0),
  [subjects, rows]);

  const className = classes.find((c: any) => c.id === classId)?.name || "";

  function buildHtml(autoPrint: boolean) {
    const head = `<tr><th class="name">الطالب</th>${subjects.map((s: any) => `<th>${esc(s.name)}</th>`).join("")}<th>المخالفات</th><th>المستوى السلوكي</th></tr>`;
    const body = students.map((st: any) => {
      const count = vCounts[st.id] ?? 0;
      const b = behaviorLevelFor(count);
      const cells = subjects.map((s: any) => {
        const lvl = grid[st.id]?.[s.id];
        return `<td>${lvl ? tag(lvl, levelColor(lvl)) : "—"}</td>`;
      }).join("");
      return `<tr><td class="name">${esc(st.full_name)}</td>${cells}<td>${count}</td><td>${b ? tag(b.label, b.color) : "—"}</td></tr>`;
    }).join("");
    return buildAcademicPrintHtml({
      title: "التقرير الأكاديمي والسلوكي الشهري",
      schoolName: settings?.school_name,
      logoUrl: settings?.logo_url,
      subtitle: `الشهر: ${month}${className ? ` — الصف: ${className}` : ""} — عدد الطلاب: ${students.length}`,
      columnCount: subjects.length + 3,
      chartsHtml: captureCharts(areaRef.current),
      legendHtml: ACADEMIC_LEVELS.map((l) => `<span style="color:${levelColor(l)};border-color:${levelColor(l)}">${l}: ${summary[l] ?? 0}</span>`).join(""),
      tableHtml: `<table><thead>${head}</thead><tbody>${body || `<tr><td colspan="${subjects.length + 3}">لا توجد بيانات</td></tr>`}</tbody></table>`,
    }, autoPrint);
  }

  return (
    <div className="space-y-4" ref={areaRef}>
      <Card className="border-0 shadow-card print:hidden">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>الصف</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" disabled={!classId} onClick={() => printHtml(buildHtml(true))}>
              <Printer className="w-4 h-4 ml-2" /> طباعة / حفظ PDF
            </Button>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" disabled={!classId} onClick={() => downloadHtml(buildHtml(false), `التقرير_الأكاديمي_${month}.html`)}>
              <Download className="w-4 h-4 ml-2" /> تحميل نسخة
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="text-center border-b pb-3">
            {settings?.logo_url && <img src={settings.logo_url} alt="شعار المدرسة" className="w-16 h-16 mx-auto object-contain mb-2" />}
            <h2 className="text-xl font-bold">{settings?.school_name || ""}</h2>
            <p className="text-sm text-muted-foreground">التقرير الأكاديمي والسلوكي الشهري — {month} {className && `— ${className}`}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {ACADEMIC_LEVELS.map((l) => (
              <Badge key={l} variant="outline" className={LEVEL_STYLES[l]}>{l}: {summary[l]}</Badge>
            ))}
          </div>

          {!classId ? (
            <p className="text-center text-muted-foreground py-8">اختر الصف لعرض التقرير</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LevelPie title="توزيع المستويات الأكاديمية" entries={summary} color={levelColor} />
                <LevelPie title="توزيع المستويات السلوكية" entries={behaviorSummary} color={levelColor} />
                <SubjectBars data={subjectAverages} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="border p-2 text-right">الطالب</th>
                      {subjects.map((s: any) => <th key={s.id} className="border p-2">{s.name}</th>)}
                      <th className="border p-2">المخالفات</th>
                      <th className="border p-2">المستوى السلوكي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st: any) => {
                      const count = vCounts[st.id] ?? 0;
                      const b = behaviorLevelFor(count);
                      return (
                        <tr key={st.id}>
                          <td className="border p-2 font-medium">{st.full_name}</td>
                          {subjects.map((s: any) => {
                            const lvl = grid[st.id]?.[s.id];
                            return (
                              <td key={s.id} className="border p-2 text-center">
                                {lvl ? <span className={`inline-block px-2 py-0.5 rounded border text-xs ${LEVEL_STYLES[lvl] || ""}`}>{lvl}</span> : "—"}
                              </td>
                            );
                          })}
                          <td className="border p-2 text-center">{count}</td>
                          <td className="border p-2 text-center">
                            {b ? (
                              <span className="inline-block px-2 py-0.5 rounded border text-xs font-medium"
                                style={{ color: b.color, borderColor: b.color, backgroundColor: `${b.color}1a` }}>{b.label}</span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CombinedReport({ month, setMonth, classId, setClassId, classes, subjects, settings }: any) {
  const monthDate = `${month}-01`;
  const { start, end } = monthRange(month);
  const { academicLevelFor, behaviorLevelFor, behaviorLevels, levelColor } = useSettings();
  const areaRef = useRef<HTMLDivElement>(null);
  const [showScoresInPrint, setShowScoresInPrint] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ["students-class-combined", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });

  const { data, isFetching } = useQuery({
    queryKey: ["combined-monthly", month, classId, students.length],
    enabled: !!classId && students.length > 0,
    queryFn: async () => {
      const ids = students.map((s: any) => s.id);
      const [ar, vi] = await Promise.all([
        supabase.from("academic_reports").select("*").eq("month", monthDate).in("student_id", ids),
        supabase.from("violations").select("id, student_id").gte("violation_date", start).lte("violation_date", end).in("student_id", ids),
      ]);
      return { academic: ar.data ?? [], violations: vi.data ?? [] };
    },
  });

  const academic = data?.academic ?? [];
  const violations = data?.violations ?? [];

  const perStudent = useMemo(() => {
    const byStudent: Record<string, any[]> = {};
    academic.forEach((r: any) => { (byStudent[r.student_id] ||= []).push(r); });
    const counts: Record<string, number> = {};
    violations.forEach((v: any) => { counts[v.student_id] = (counts[v.student_id] ?? 0) + 1; });

    return students.map((st: any) => {
      const recs = byStudent[st.id] ?? [];
      const bySubject: Record<string, { level: string; score: number | null }> = {};
      recs.forEach((r: any) => { bySubject[r.subject_id] = { level: r.level, score: r.score ?? null }; });
      const withScores = recs.filter((r: any) => r.score !== null && r.score !== undefined);
      const avg = withScores.length
        ? withScores.reduce((a: number, r: any) => a + Number(r.score), 0) / withScores.length
        : null;
      const overall = avg !== null ? academicLevelFor(avg) : mostCommonLevel(recs.map((r: any) => r.level));
      const vCount = counts[st.id] ?? 0;
      return { student: st, bySubject, avg, overall, vCount, behavior: behaviorLevelFor(vCount) };
    });
  }, [students, academic, violations, academicLevelFor, behaviorLevelFor]);

  const academicSummary = useMemo(() => {
    const s: Record<string, number> = {};
    ACADEMIC_LEVELS.forEach((l) => { s[l] = 0; });
    perStudent.forEach((r) => { if (r.overall) s[r.overall] = (s[r.overall] ?? 0) + 1; });
    return s;
  }, [perStudent]);

  const behaviorSummary = useMemo(() => {
    const s: Record<string, number> = {};
    behaviorLevels.forEach((l) => { s[l.label] = 0; });
    perStudent.forEach((r) => { if (r.behavior) s[r.behavior.label] = (s[r.behavior.label] ?? 0) + 1; });
    return s;
  }, [perStudent, behaviorLevels]);

  const subjectAverages = useMemo(() =>
    subjects.map((sub: any) => {
      const list = academic.filter((r: any) => r.subject_id === sub.id).map((r: any) => LEVEL_SCORE[r.level] ?? 0).filter(Boolean);
      return { name: sub.name, value: list.length ? Number((list.reduce((a: number, b: number) => a + b, 0) / list.length).toFixed(2)) : 0 };
    }).filter((d: any) => d.value > 0),
  [subjects, academic]);

  const className = classes.find((c: any) => c.id === classId)?.name || "";

  function buildHtml(autoPrint: boolean) {
    const head = `<tr><th class="name">الطالب</th>${subjects.map((s: any) => `<th>${esc(s.name)}</th>`).join("")}<th>المعدل</th><th>المستوى الأكاديمي</th><th>المخالفات</th><th>المستوى السلوكي</th></tr>`;
    const body = perStudent.map((r) => {
      const cells = subjects.map((s: any) => {
        const cell = r.bySubject[s.id];
        const extra = showScoresInPrint && cell?.score !== null && cell?.score !== undefined ? ` (${cell.score})` : "";
        return `<td>${cell ? tag(cell.level, levelColor(cell.level), extra) : "—"}</td>`;
      }).join("");
      return `<tr><td class="name">${esc(r.student.full_name)}</td>${cells}` +
        `<td>${r.avg !== null ? r.avg.toFixed(1) : "—"}</td>` +
        `<td>${r.overall ? tag(r.overall, levelColor(r.overall)) : "—"}</td>` +
        `<td>${r.vCount}</td>` +
        `<td>${r.behavior ? tag(r.behavior.label, r.behavior.color) : "—"}</td></tr>`;
    }).join("");
    const cols = subjects.length + 5;
    return buildAcademicPrintHtml({
      title: "التقرير الشهري الموحّد (أكاديمي وسلوكي)",
      schoolName: settings?.school_name,
      logoUrl: settings?.logo_url,
      subtitle: `الشهر: ${month}${className ? ` — الصف: ${className}` : ""} — عدد الطلاب: ${perStudent.length}`,
      columnCount: cols,
      chartsHtml: captureCharts(areaRef.current),
      legendHtml: [
        ...Object.entries(academicSummary).map(([l, v]) => `<span style="color:${levelColor(l)};border-color:${levelColor(l)}">أكاديمي ${esc(l)}: ${v}</span>`),
        ...Object.entries(behaviorSummary).map(([l, v]) => `<span style="color:${levelColor(l)};border-color:${levelColor(l)}">سلوكي ${esc(l)}: ${v}</span>`),
      ].join(""),
      tableHtml: `<table><thead>${head}</thead><tbody>${body || `<tr><td colspan="${cols}">لا توجد بيانات</td></tr>`}</tbody></table>`,
    }, autoPrint);
  }

  return (
    <div className="space-y-4" ref={areaRef}>
      <Card className="border-0 shadow-card print:hidden">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>الصف</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" disabled={!classId} onClick={() => printHtml(buildHtml(true))}>
              <Printer className="w-4 h-4 ml-2" /> طباعة / حفظ PDF
            </Button>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" disabled={!classId} onClick={() => downloadHtml(buildHtml(false), `التقرير_الموحد_${month}.html`)}>
              <Download className="w-4 h-4 ml-2" /> تحميل نسخة
            </Button>
          </div>
          <label className="md:col-span-4 flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={showScoresInPrint} onCheckedChange={(v) => setShowScoresInPrint(!!v)} />
            إظهار الدرجات في الطباعة (غير مفعّل افتراضياً)
          </label>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="text-center border-b pb-3">
            {settings?.logo_url && <img src={settings.logo_url} alt="شعار المدرسة" className="w-16 h-16 mx-auto object-contain mb-2" />}
            <h2 className="text-xl font-bold">{settings?.school_name || ""}</h2>
            <p className="text-sm text-muted-foreground">التقرير الشهري الأكاديمي والسلوكي — {month} {className && `— ${className}`}</p>
          </div>

          {!classId ? (
            <p className="text-center text-muted-foreground py-8">اختر الصف لعرض التقرير</p>
          ) : isFetching ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LevelPie title="التوزيع الأكاديمي" entries={academicSummary} color={levelColor} />
                <LevelPie title="التوزيع السلوكي" entries={behaviorSummary} color={levelColor} />
                <SubjectBars data={subjectAverages} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="border p-2 text-right">الطالب</th>
                      {subjects.map((s: any) => <th key={s.id} className="border p-2">{s.name}</th>)}
                      <th className="border p-2">المعدل</th>
                      <th className="border p-2">المستوى الأكاديمي</th>
                      <th className="border p-2">المخالفات</th>
                      <th className="border p-2">المستوى السلوكي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perStudent.map((r) => (
                      <tr key={r.student.id}>
                        <td className="border p-2 font-medium">{r.student.full_name}</td>
                        {subjects.map((s: any) => {
                          const cell = r.bySubject[s.id];
                          return (
                            <td key={s.id} className="border p-2 text-center">
                              {cell ? (
                                <span className={`inline-block px-2 py-0.5 rounded border text-xs ${LEVEL_STYLES[cell.level] || ""}`}>
                                  {cell.level}{cell.score !== null ? ` (${cell.score})` : ""}
                                </span>
                              ) : "—"}
                            </td>
                          );
                        })}
                        <td className="border p-2 text-center">{r.avg !== null ? r.avg.toFixed(1) : "—"}</td>
                        <td className="border p-2 text-center">
                          {r.overall ? <span className={`inline-block px-2 py-0.5 rounded border text-xs ${LEVEL_STYLES[r.overall] || ""}`}>{r.overall}</span> : "—"}
                        </td>
                        <td className="border p-2 text-center">{r.vCount}</td>
                        <td className="border p-2 text-center">
                          {r.behavior ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded border text-xs font-medium"
                              style={{ color: r.behavior.color, borderColor: r.behavior.color, backgroundColor: `${r.behavior.color}1a` }}
                            >{r.behavior.label}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function mostCommonLevel(list: string[]): string | null {
  if (!list.length) return null;
  const counts: Record<string, number> = {};
  list.forEach((l) => { counts[l] = (counts[l] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
