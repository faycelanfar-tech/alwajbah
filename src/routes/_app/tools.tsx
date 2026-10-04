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
import { Shuffle, Users, Award, CalendarDays, Plus, Minus, Printer, RotateCcw } from "lucide-react";
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
          <TabsTrigger value="weekly"><CalendarDays className="w-4 h-4 ml-1" /> الملخص الأسبوعي</TabsTrigger>
        </TabsList>
        <TabsContent value="wheel" className="mt-4"><Wheel classId={classId} /></TabsContent>
        <TabsContent value="groups" className="mt-4"><Groups classId={classId} /></TabsContent>
        <TabsContent value="certs" className="mt-4"><Certificates classId={classId} /></TabsContent>
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
  const { displayName, settings } = useSettings();
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("لتميّزه في الانضباط والسلوك الحسن والمشاركة الفعّالة");
  useEffect(() => setSelected([]), [classId]);
  if (!classId) return <NeedClass />;
  function print() {
    const names = students.filter((s) => selected.includes(s.id)).map((s) => s.full_name);
    const date = new Date().toLocaleDateString("ar-EG-u-nu-latn");
    const pages = names.map((n) => `<div class="cert">
      ${settings.logo_url ? `<img src="${esc(settings.logo_url)}">` : ""}
      <h2>${esc(displayName)}</h2><h1>شهادة شكر وتقدير</h1>
      <p>تتقدم إدارة المدرسة بخالص الشكر والتقدير للطالب</p>
      <div class="name">${esc(n)}</div><p>${esc(reason)}</p><p>متمنين له دوام التوفيق والنجاح</p>
      <div class="sig"><div>المعلم<br>${esc(profile?.full_name || "")}<br>........................</div><div>مدير المدرسة<br><br>........................</div></div>
      <small>${date}</small></div>`).join("");
    printHtml(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>شهادات تقدير</title><style>
      @page{size:A4 landscape;margin:10mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{margin:0;font-family:'Segoe UI',Tahoma,Arial,sans-serif}
      .cert{height:185mm;border:10px double #b8860b;padding:20px 40px;text-align:center;page-break-after:always;box-sizing:border-box}
      .cert img{height:70px}h1{font-size:40px;color:#b8860b;margin:6px 0}h2{margin:4px 0;color:#1d4ed8}
      p{font-size:20px;margin:8px 0}.name{font-size:36px;font-weight:700;border-bottom:2px dotted #333;display:inline-block;padding:4px 40px;margin:10px}
      .sig{display:flex;justify-content:space-around;margin-top:24px;font-size:16px}small{color:#666}
    </style></head><body>${pages}<script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
  }
  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-4 space-y-4">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التكريم" />
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
