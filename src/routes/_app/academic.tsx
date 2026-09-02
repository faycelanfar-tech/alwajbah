import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { ACADEMIC_LEVELS, LEVEL_STYLES, isReadOnlyRole } from "@/lib/branding";
import { toast } from "sonner";
import { Printer, Save, Loader2 } from "lucide-react";

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

function AcademicPage() {
  const { user, role } = useAuth();
  const { settings } = useSettings();
  const qc = useQueryClient();
  const readOnly = isReadOnlyRole(role) || role === "supervisor";

  const [month, setMonth] = useState(monthKey(new Date()));
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [levels, setLevels] = useState<Record<string, string>>({});

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

  const subjects = isTeacher && myAssign?.subjectIds.length
    ? allSubjects.filter((s: any) => myAssign.subjectIds.includes(s.id))
    : allSubjects;
  const classes = isTeacher && myAssign?.classIds.length
    ? allClasses.filter((c: any) => myAssign.classIds.includes(c.id))
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
      (data ?? []).forEach((r: any) => { map[r.student_id] = r.level; });
      setLevels(map);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(levels)
        .filter(([, lvl]) => !!lvl)
        .map(([student_id, level]) => ({ student_id, subject_id: subjectId, month: monthDate, level, created_by: user?.id }));
      if (!rows.length) throw new Error("لم يتم تحديد أي مستوى");
      const { error } = await supabase.from("academic_reports").upsert(rows as any, { onConflict: "student_id,subject_id,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التقرير الأكاديمي");
      qc.invalidateQueries({ queryKey: ["academic"] });
      qc.invalidateQueries({ queryKey: ["academic-monthly"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAll = (lvl: string) => {
    const next: Record<string, string> = {};
    students.forEach((s: any) => { next[s.id] = lvl; });
    setLevels(next);
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
        </TabsList>

        <TabsContent value="entry" className="mt-4 space-y-4">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle>اختيار الشهر والصف والمادة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>الصف</Label>
                <Select value={classId} onValueChange={(v) => { setClassId(v); setLevels({}); }}>
                  <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المادة</Label>
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setLevels({}); }}>
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
                    <span className="text-sm text-muted-foreground self-center">تعيين الكل:</span>
                    {ACADEMIC_LEVELS.map((l) => (
                      <Button key={l} size="sm" variant="outline" onClick={() => setAll(l)}>{l}</Button>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {isFetching && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                {students.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border flex-wrap">
                    <span className="font-medium">{s.full_name}</span>
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
      </Tabs>
    </div>
  );
}

function MonthlyReport({ month, setMonth, classId, setClassId, classes, subjects, settings }: any) {
  const monthDate = `${month}-01`;
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

  const grid = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    rows.forEach((r: any) => {
      map[r.student_id] = map[r.student_id] || {};
      map[r.student_id][r.subject_id] = r.level;
    });
    return map;
  }, [rows]);

  const summary = useMemo(() => {
    const s: Record<string, number> = {};
    ACADEMIC_LEVELS.forEach((l) => { s[l] = 0; });
    rows.forEach((r: any) => { if (s[r.level] !== undefined) s[r.level]++; });
    return s;
  }, [rows]);

  const className = classes.find((c: any) => c.id === classId)?.name || "";

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card print:hidden">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>الصف</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" /> طباعة / حفظ PDF</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="text-center border-b pb-3">
            {settings?.logo_url && <img src={settings.logo_url} alt="شعار المدرسة" className="w-16 h-16 mx-auto object-contain mb-2" />}
            <h2 className="text-xl font-bold">{settings?.school_name || ""}</h2>
            <p className="text-sm text-muted-foreground">التقرير الأكاديمي الشهري — {month} {className && `— ${className}`}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {ACADEMIC_LEVELS.map((l) => (
              <Badge key={l} variant="outline" className={LEVEL_STYLES[l]}>{l}: {summary[l]}</Badge>
            ))}
          </div>

          {!classId ? (
            <p className="text-center text-muted-foreground py-8">اختر الصف لعرض التقرير</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-secondary">
                    <th className="border p-2 text-right">الطالب</th>
                    {subjects.map((s: any) => <th key={s.id} className="border p-2">{s.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((st: any) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
