import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Users, Award, CalendarDays, Plus, Minus, Printer, RotateCcw, Timer, MessageSquareWarning, Play, Pause, Trash2 } from "lucide-react";
import { esc, printHtml } from "@/lib/academic-print";

export const Route = createFileRoute("/_app/tools")({
  component: ToolsPage,
  head: () => ({
    meta: [
      { title: "أدوات الصف | نظام المتابعة المدرسية" },
      { name: "description", content: "عجلة اختيار طالب، نقاط المجموعات، شهادات التقدير، والملخص الأسبوعي." },
      { property: "og:title", content: "أدوات الصف" },
      { property: "og:description", content: "أدوات تفاعلية للمعلمين والمشرفين داخل الصف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function useMyClasses() {
  const { role, user } = useAuth();
  return useQuery({
    queryKey: ["tools-classes", user?.id, role],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: all } = await supabase.from("classes").select("id, name").order("name");
      if (role !== "teacher") return all ?? [];
      const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("user_id", user!.id);
      const ids = (tc ?? []).map((r: any) => r.class_id);
      return (all ?? []).filter((c: any) => ids.includes(c.id));
    },
  });
}

function useStudents(classId: string) {
  return useQuery({
    queryKey: ["tools-students", classId],
    enabled: !!classId,
    queryFn: async () =>
      ((await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? []) as any[],
  });
}

function ClassPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: classes = [] } = useMyClasses();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-60"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
      <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ToolsPage() {
  const [classId, setClassId] = useState("");
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">أدوات الصف</h1>
          <p className="text-muted-foreground mt-1">أدوات سريعة تساعد المعلم داخل الحصة والمشرف في المتابعة</p>
        </div>
        <ClassPicker value={classId} onChange={setClassId} />
      </div>
      <Tabs defaultValue="wheel">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="wheel"><Shuffle className="w-4 h-4 ml-1" /> اختيار عشوائي</TabsTrigger>
          <TabsTrigger value="groups"><Users className="w-4 h-4 ml-1" /> نقاط المجموعات</TabsTrigger>
          <TabsTrigger value="certs"><Award className="w-4 h-4 ml-1" /> شهادات التقدير</TabsTrigger>
          <TabsTrigger value="timer"><Timer className="w-4 h-4 ml-1" /> مؤقت الحصة</TabsTrigger>
          <TabsTrigger value="warnings"><MessageSquareWarning className="w-4 h-4 ml-1" /> التنبيهات الشفهية</TabsTrigger>
          <TabsTrigger value="weekly"><CalendarDays className="w-4 h-4 ml-1" /> الملخص الأسبوعي</TabsTrigger>
        </TabsList>
        <TabsContent value="wheel" className="mt-4"><Wheel classId={classId} /></TabsContent>
        <TabsContent value="groups" className="mt-4"><Groups classId={classId} /></TabsContent>
        <TabsContent value="certs" className="mt-4"><Certificates classId={classId} /></TabsContent>
        <TabsContent value="timer" className="mt-4"><ClassTimer /></TabsContent>
        <TabsContent value="warnings" className="mt-4"><VerbalWarnings classId={classId} /></TabsContent>
        <TabsContent value="weekly" className="mt-4"><Weekly /></TabsContent>
      </Tabs>
    </div>
  );
}

const NeedClass = () => <p className="text-center text-muted-foreground py-12">اختر الصف أولاً من الأعلى</p>;

function Wheel({ classId }: { classId: string }) {
  const { data: students = [] } = useStudents(classId);
  const [shown, setShown] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  useEffect(() => { setUsed([]); setShown(""); }, [classId]);
  if (!classId) return <NeedClass />;
  const pool = students.filter((s) => !used.includes(s.id));
  function spin() {
    if (!pool.length) return;
    setSpinning(true);
    let n = 0;
    const t = setInterval(() => {
      setShown(pool[Math.floor(Math.random() * pool.length)].full_name);
      if (++n > 18) {
        clearInterval(t);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setShown(pick.full_name); setUsed((u) => [...u, pick.id]); setSpinning(false);
      }
    }, 80);
  }
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-8 text-center space-y-6">
        <div className="min-h-[96px] flex items-center justify-center rounded-2xl bg-primary/10 border-2 border-primary/30">
          <span className={`text-4xl font-bold ${spinning ? "opacity-60" : "text-primary"}`}>{shown || "؟"}</span>
        </div>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={spin} disabled={spinning || !pool.length}><Shuffle className="w-5 h-5 ml-1" /> اختر طالباً</Button>
          <Button size="lg" variant="outline" onClick={() => { setUsed([]); setShown(""); }}><RotateCcw className="w-4 h-4 ml-1" /> إعادة</Button>
        </div>
        <p className="text-sm text-muted-foreground">لا يتكرر الطالب حتى يتم اختيار الجميع — المتبقي {pool.length} من {students.length}</p>
      </CardContent>
    </Card>
  );
}

type Group = { name: string; members: string[]; points: number };

function Groups({ classId }: { classId: string }) {
  const { data: students = [] } = useStudents(classId);
  const key = `awj-groups-${classId}`;
  const [groups, setGroups] = useState<Group[]>([]);
  const [count, setCount] = useState(4);
  useEffect(() => {
    if (!classId) return;
    try { setGroups(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setGroups([]); }
  }, [classId]);
  const save = (g: Group[]) => { setGroups(g); localStorage.setItem(key, JSON.stringify(g)); };
  if (!classId) return <NeedClass />;
  function make() {
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const g: Group[] = Array.from({ length: count }, (_, i) => ({ name: `المجموعة ${i + 1}`, members: [], points: 0 }));
    shuffled.forEach((s, i) => g[i % count].members.push(s.full_name));
    save(g);
  }
  const max = Math.max(0, ...groups.map((g) => g.points));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">عدد المجموعات</span>
        <Input type="number" min={2} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(2, +e.target.value || 2)))} className="w-20" />
        <Button onClick={make}>توزيع عشوائي</Button>
        {groups.length > 0 && <Button variant="outline" onClick={() => save(groups.map((g) => ({ ...g, points: 0 })))}>تصفير النقاط</Button>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map((g, i) => (
          <Card key={i} className={`border-2 ${g.points === max && max > 0 ? "border-primary" : "border-transparent"} shadow-card`}>
            <CardHeader className="pb-2">
              <Input value={g.name} onChange={(e) => save(groups.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="font-bold" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Button size="icon" variant="outline" onClick={() => save(groups.map((x, j) => j === i ? { ...x, points: x.points - 1 } : x))}><Minus className="w-4 h-4" /></Button>
                <span className="text-3xl font-bold">{g.points} {g.points === max && max > 0 ? "🏆" : ""}</span>
                <Button size="icon" onClick={() => save(groups.map((x, j) => j === i ? { ...x, points: x.points + 1 } : x))}><Plus className="w-4 h-4" /></Button>
              </div>
              <ul className="text-sm text-muted-foreground space-y-0.5">{g.members.map((m) => <li key={m}>• {m}</li>)}</ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Certificates({ classId }: { classId: string }) {
  const { data: students = [] } = useStudents(classId);
  const { settings } = useSettings();
  const { profile, user } = useAuth();
  const { data: subjects = [] } = useQuery({
    queryKey: ["tools-my-subjects", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: all } = await supabase.from("subjects").select("id, name").order("sort_order");
      const { data: ts } = await supabase.from("teacher_subjects").select("subject_id").eq("user_id", user!.id);
      const ids = (ts ?? []).map((r: any) => r.subject_id);
      const mine = (all ?? []).filter((s: any) => ids.includes(s.id));
      return (mine.length ? mine : all ?? []) as any[];
    },
  });
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("تفوّقه وجهده المتميز والتزامه الأكاديمي");
  useEffect(() => setSelected([]), [classId]);
  useEffect(() => { if (!subject && subjects.length) setSubject(subjects[0].name); }, [subjects, subject]);
  if (!classId) return <NeedClass />;
  function print() {
    const names = students.filter((s) => selected.includes(s.id)).map((s) => s.full_name);
    const school = (settings.school_name || "").trim();
    const subj = esc(subject || "........");
    const pages = names.map((n) => `<div class="cert"><div class="inner">
      <div class="bsm">بِسمِ اللهِ الرَّحمَٰنِ الرَّحِيم</div>
      <div class="min">وزارة التربية والتعليم والتعليم العالي</div>
      ${school ? `<div class="min">${esc(school)}</div>` : ""}
      <h1>شهادة تقدير وتكريم</h1>
      <p>تُقدّم إدارة المدرسة ومعلّم مادة <b>${subj}</b> بخالص الشُّكرِ والتقديرِ للطالب:</p>
      <div class="name">${esc(n)}</div>
      <p>وذلك نظير ${esc(reason)} وتألّقه الملحوظ خلال الفصل الدراسي في مادة <b>${subj}</b>،<br>متمنّين له دوام التوفيق والنجاح ومزيداً من العطاء.</p>
      <div class="sig"><div>التاريخ: ____/____/${new Date().getFullYear()} م</div><div>معلّم المادة<br><b>${esc(profile?.full_name || "")}</b><br>.......................</div></div>
    </div></div>`).join("");
    printHtml(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>شهادات تقدير - ${subj}</title><style>
      @page{size:A4 landscape;margin:8mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
      body{margin:0;font-family:'Traditional Arabic','Amiri','Times New Roman',serif;color:#1f2937}
      .cert{height:192mm;padding:9px;border:14px solid #1e3a5f;outline:4px solid #b8860b;outline-offset:-22px;background:#fbf7ee;page-break-after:always}
      .inner{height:100%;border:3px double #b8860b;padding:14px 50px;text-align:center;display:flex;flex-direction:column;justify-content:center}
      .bsm{font-size:22px}.min{font-size:21px;font-weight:700;margin:2px 0}
      h1{font-size:58px;color:#b8860b;margin:8px 0 12px;font-weight:800;text-shadow:1px 1px 0 #7a5a12}
      p{font-size:22px;margin:6px 0;line-height:1.7}
      .name{font-size:34px;font-weight:800;color:#7f1d1d;border-bottom:3px double #b8860b;display:inline-block;padding:2px 60px;margin:6px auto 10px}
      .sig{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;font-size:20px;padding:0 30px}
    </style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
  }
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="اسم المادة" /></SelectTrigger>
            <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="وذلك نظير ..." />
        </div>
        <p className="text-xs text-muted-foreground">تصدر الشهادة باسم المادة ويوقّعها معلّم المادة فقط.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelected(students.map((s) => s.id))}>تحديد الكل</Button>
          <Button variant="outline" size="sm" onClick={() => setSelected([])}>إلغاء التحديد</Button>
          <Button size="sm" onClick={print} disabled={!selected.length}><Printer className="w-4 h-4 ml-1" /> طباعة ({selected.length})</Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected((x) => e.target.checked ? [...x, s.id] : x.filter((i) => i !== s.id))} />
              {s.full_name}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ClassTimer() {
  const [total, setTotal] = useState(300);
  const [left, setLeft] = useState(300);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) {
        setRunning(false);
        try {
          const ctx = new AudioContext(); const o = ctx.createOscillator(); o.frequency.value = 880;
          o.connect(ctx.destination); o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 900);
        } catch { /* لا صوت */ }
        return 0;
      }
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running]);
  const set = (s: number) => { setTotal(s); setLeft(s); setRunning(false); };
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const pct = total ? (left / total) * 100 : 0;
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-8 text-center space-y-6">
        <div className="flex justify-center gap-2 flex-wrap">
          {[1, 3, 5, 10, 15, 20].map((m) => <Button key={m} variant={total === m * 60 ? "default" : "outline"} size="sm" onClick={() => set(m * 60)}>{m} د</Button>)}
        </div>
        <div className={`text-7xl font-bold tabular-nums ${left === 0 ? "text-destructive" : "text-primary"}`} dir="ltr">{mm}:{ss}</div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={() => setRunning((r) => !r)} disabled={left === 0}>{running ? <><Pause className="w-5 h-5 ml-1" /> إيقاف مؤقت</> : <><Play className="w-5 h-5 ml-1" /> ابدأ</>}</Button>
          <Button size="lg" variant="outline" onClick={() => set(total)}><RotateCcw className="w-4 h-4 ml-1" /> إعادة</Button>
        </div>
        <p className="text-sm text-muted-foreground">يصدر تنبيه صوتي عند انتهاء الوقت — مناسب للأنشطة والمسابقات والعمل الجماعي.</p>
      </CardContent>
    </Card>
  );
}

type Warn = { id: string; student: string; date: string; reason: string };
function VerbalWarnings({ classId }: { classId: string }) {
  const { data: students = [] } = useStudents(classId);
  const key = `awj-warnings-${classId}`;
  const [list, setList] = useState<Warn[]>([]);
  const [student, setStudent] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!classId) return;
    try { setList(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setList([]); }
  }, [classId]);
  if (!classId) return <NeedClass />;
  const save = (l: Warn[]) => { setList(l); localStorage.setItem(key, JSON.stringify(l)); };
  const add = () => {
    if (!student) return;
    save([{ id: String(Date.now()), student, date: new Date().toISOString().slice(0, 10), reason: reason.trim() }, ...list]);
    setReason("");
  };
  const counts: Record<string, number> = {};
  list.forEach((w) => { counts[w.student] = (counts[w.student] || 0) + 1; });
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
            <Select value={student} onValueChange={setStudent}>
              <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.full_name}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التنبيه (اختياري)" />
            <Button onClick={add} disabled={!student}><Plus className="w-4 h-4 ml-1" /> تسجيل تنبيه</Button>
          </div>
          <p className="text-xs text-muted-foreground">سجل خاص بهذا الجهاز لتوثيق التنبيهات الشفهية قبل تحويل الطالب للمشرف (نموذج 3). يظهر تحذير عند 3 تنبيهات.</p>
        </CardContent>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
          <div key={n} className={`flex justify-between items-center p-3 rounded-lg border ${c >= 3 ? "border-destructive bg-destructive/10" : "bg-secondary/40"}`}>
            <span className="font-medium">{n}</span><span className="font-bold">{c} {c >= 3 ? "— يُحوَّل للمشرف" : ""}</span>
          </div>
        ))}
      </div>
      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle className="text-base">السجل</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تنبيهات</p>}
          {list.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 border-b last:border-0 py-1 text-sm">
              <span><b>{w.student}</b> — {w.date}{w.reason ? ` — ${w.reason}` : ""}</span>
              <Button size="icon" variant="ghost" onClick={() => save(list.filter((x) => x.id !== w.id))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Weekly() {
  const { role, user } = useAuth();
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }, []);
  const { data: rows = [] } = useQuery({
    queryKey: ["weekly-summary", from, role, user?.id],
    queryFn: async () => {
      let q = supabase.from("violations").select("id, action_taken, violation_date, created_by, students(full_name, classes(name)), violation_types(name)").gte("violation_date", from);
      if (role === "teacher") q = q.eq("created_by", user!.id);
      return ((await q).data ?? []) as any[];
    },
  });
  const top = (f: (v: any) => string) => {
    const m: Record<string, number> = {};
    rows.forEach((v) => { const k = f(v) || "—"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const pending = rows.filter((v) => !v.action_taken).length;
  const box = (t: string, list: [string, number][]) => (
    <Card className="border-0 shadow-card"><CardHeader><CardTitle className="text-base">{t}</CardTitle></CardHeader>
      <CardContent>{list.length ? list.map(([k, n]) => <div key={k} className="flex justify-between py-1 border-b last:border-0 text-sm"><span>{k}</span><b>{n}</b></div>) : <p className="text-sm text-muted-foreground">لا بيانات</p>}</CardContent></Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["مخالفات هذا الأسبوع", rows.length], ["بانتظار إجراء", pending], ["تم اتخاذ إجراء", rows.length - pending]].map(([l, v]) => (
          <Card key={l as string} className="border-0 shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="text-3xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {box("أكثر المخالفات", top((v) => v.violation_types?.name))}
        {box("أكثر الصفوف", top((v) => v.students?.classes?.name))}
        {box("طلاب يحتاجون متابعة", top((v) => v.students?.full_name))}
      </div>
    </div>
  );
}
