import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, Minus, RotateCcw, Medal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rewards")({ component: RewardsPage });

function weekStart(d = new Date()) {
  const day = d.getDay();
  const diff = (day + 6) % 7; // monday-based like postgres date_trunc('week')
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return m.toISOString().slice(0, 10);
}

function RewardsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: students = [] } = useQuery({
    queryKey: ["students-rewards"],
    queryFn: async () => (await supabase.from("students").select("id, full_name, class_id, classes(name)").order("full_name")).data ?? [],
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: studentPoints = [] } = useQuery({
    queryKey: ["student_points"],
    queryFn: async () => (await (supabase.from as any)("student_points").select("*")).data ?? [],
  });
  const { data: classPoints = [] } = useQuery({
    queryKey: ["class_weekly_points", weekStart()],
    queryFn: async () => (await (supabase.from as any)("class_weekly_points").select("*").eq("week_start", weekStart())).data ?? [],
  });

  const studentMap = new Map<string, number>(studentPoints.map((p: any) => [p.student_id, p.points]));
  const classMap = new Map<string, number>(classPoints.map((p: any) => [p.class_id, p.points]));

  const studentsRanked = students
    .map((s: any) => ({ ...s, points: studentMap.get(s.id) ?? 50 }))
    .sort((a, b) => b.points - a.points);

  const classesRanked = classes
    .map((c: any) => ({ ...c, points: classMap.get(c.id) ?? 300 }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="w-7 h-7 text-amber-500" /> النقاط والمكافآت</h1>
          <p className="text-muted-foreground mt-1">نظام تعزيز إيجابي — كل طالب يبدأ بـ 50 نقطة، كل صف بـ 300 نقطة أسبوعياً</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <ResetWeekDialog classes={classes} />}
          <AdjustPointsDialog students={students} classes={classes} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Medal className="w-5 h-5 text-amber-500" /> أوائل الانضباط (الطلاب)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {studentsRanked.slice(0, 30).map((s: any, i) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <RankBadge rank={i + 1} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.classes?.name || "—"}</p>
                    </div>
                  </div>
                  <PointsBadge points={s.points} />
                </div>
              ))}
              {studentsRanked.length === 0 && <p className="text-center text-muted-foreground py-6">لا يوجد طلاب</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-emerald-500" /> الصفوف الأسبوعية (300 نقطة)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classesRanked.map((c: any, i) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <RankBadge rank={i + 1} />
                    <p className="font-medium">{c.name}</p>
                  </div>
                  <PointsBadge points={c.points} max={300} />
                </div>
              ))}
              {classesRanked.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد صفوف</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <RecentTransactions />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ["bg-amber-500", "bg-slate-400", "bg-orange-600"];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${colors[rank - 1] || "bg-muted text-foreground"}`}>
      {rank}
    </div>
  );
}

function PointsBadge({ points, max = 50 }: { points: number; max?: number }) {
  const color = points >= max * 0.8 ? "bg-emerald-100 text-emerald-700" : points >= max * 0.5 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge variant="outline" className={color}>{points} نقطة</Badge>;
}

function AdjustPointsDialog({ students, classes }: { students: any[]; classes: any[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"student" | "class">("student");
  const [classFilter, setClassFilter] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [delta, setDelta] = useState("5");
  const [sign, setSign] = useState<"+" | "-">("+");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const filteredStudents = classFilter ? students.filter((s) => s.class_id === classFilter) : students;

  const submit = useMutation({
    mutationFn: async () => {
      const d = (sign === "+" ? 1 : -1) * Number(delta);
      if (!d) throw new Error("أدخل قيمة");
      if (target === "student") {
        if (!studentId) throw new Error("اختر طالباً");
        const s = students.find((x) => x.id === studentId);
        // upsert points
        const { data: cur } = await (supabase.from as any)("student_points").select("points").eq("student_id", studentId).maybeSingle();
        const newPts = (cur?.points ?? 50) + d;
        const { error: e1 } = await (supabase.from as any)("student_points").upsert({ student_id: studentId, points: newPts, updated_at: new Date().toISOString() });
        if (e1) throw e1;
        const { error: e2 } = await (supabase.from as any)("point_transactions").insert({
          student_id: studentId, class_id: s?.class_id ?? null, delta: d, reason: reason || (d > 0 ? "مكافأة" : "خصم يدوي"),
          kind: d > 0 ? "reward" : "manual", created_by: user!.id,
        });
        if (e2) throw e2;
      } else {
        if (!classId) throw new Error("اختر صفاً");
        const wk = weekStart();
        const { data: cur } = await (supabase.from as any)("class_weekly_points").select("points").eq("class_id", classId).eq("week_start", wk).maybeSingle();
        const newPts = (cur?.points ?? 300) + d;
        const { error: e1 } = await (supabase.from as any)("class_weekly_points").upsert({ class_id: classId, week_start: wk, points: newPts, updated_at: new Date().toISOString() }, { onConflict: "class_id,week_start" });
        if (e1) throw e1;
        const { error: e2 } = await (supabase.from as any)("point_transactions").insert({
          student_id: null, class_id: classId, delta: d, reason: reason || (d > 0 ? "مكافأة صف" : "خصم صف"),
          kind: d > 0 ? "reward" : "manual", created_by: user!.id,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["student_points"] });
      qc.invalidateQueries({ queryKey: ["class_weekly_points"] });
      qc.invalidateQueries({ queryKey: ["point_transactions"] });
      setOpen(false);
      setReason(""); setStudentId(""); setClassId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 ml-1" /> خصم / مكافأة</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>تعديل النقاط</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={target === "student" ? "default" : "outline"} onClick={() => setTarget("student")}>طالب</Button>
            <Button variant={target === "class" ? "default" : "outline"} onClick={() => setTarget("class")}>صف</Button>
          </div>

          {target === "student" ? (
            <>
              <div className="space-y-2">
                <Label>الصف (تصفية)</Label>
                <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setStudentId(""); }}>
                  <SelectTrigger><SelectValue placeholder="كل الصفوف" /></SelectTrigger>
                  <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الطالب *</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                  <SelectContent>{filteredStudents.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>الصف *</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2 col-span-1">
              <Label>النوع</Label>
              <div className="flex">
                <Button type="button" variant={sign === "+" ? "default" : "outline"} className="rounded-l-none flex-1" onClick={() => setSign("+")}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button type="button" variant={sign === "-" ? "default" : "outline"} className="rounded-r-none flex-1" onClick={() => setSign("-")}>
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>عدد النقاط</Label>
              <Input type="number" min={1} value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>السبب</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: التزام تام، نظافة، مساعدة..." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetWeekDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: async () => {
      const wk = weekStart();
      const rows = classes.map((c: any) => ({ class_id: c.id, week_start: wk, points: 300, updated_at: new Date().toISOString() }));
      const { error } = await (supabase.from as any)("class_weekly_points").upsert(rows, { onConflict: "class_id,week_start" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إعادة 300 نقطة لكل صف");
      qc.invalidateQueries({ queryKey: ["class_weekly_points"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><RotateCcw className="w-4 h-4 ml-1" /> إعادة الأسبوع</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>إعادة نقاط الأسبوع</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">سيتم إعادة جميع الصفوف إلى 300 نقطة لهذا الأسبوع.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => reset.mutate()} disabled={reset.isPending}>تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecentTransactions() {
  const { data = [] } = useQuery({
    queryKey: ["point_transactions"],
    queryFn: async () => (await (supabase.from as any)("point_transactions")
      .select("*, students(full_name), classes(name)")
      .order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>آخر الحركات</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.length === 0 && <p className="text-center text-muted-foreground py-6">لا توجد حركات</p>}
          {data.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded border">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {t.students?.full_name || t.classes?.name || "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{t.reason}</p>
              </div>
              <Badge variant="outline" className={t.delta > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                {t.delta > 0 ? "+" : ""}{t.delta}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
