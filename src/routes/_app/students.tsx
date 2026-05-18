import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ClipboardPaste, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/students")({ component: StudentsPage });

function StudentsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*, classes(name)").order("full_name")).data ?? [],
  });

  const filtered = students.filter((s: any) => {
    const matchSearch = !search || s.full_name.includes(search) || (s.student_number || "").includes(search);
    const matchClass = filterClass === "all" || s.class_id === filterClass;
    return matchSearch && matchClass;
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("students").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">الطلاب</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات الطلاب</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <PasteImportDialog classes={classes} />
            <AddStudentDialog classes={classes} />
          </div>
        )}
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم" className="pr-9" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفصول</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold">رقم الطالب</th>
                  <th className="text-right p-3 font-semibold">الفصل</th>
                  {isAdmin && <th className="text-center p-3 font-semibold w-20">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted-foreground py-8">لا توجد بيانات</td></tr>
                )}
                {filtered.map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-secondary/30">
                    <td className="p-3 font-medium">{s.full_name}</td>
                    <td className="p-3 text-muted-foreground">{s.student_number || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.classes?.name || "—"}</td>
                    {isAdmin && (
                      <td className="p-3 text-center">
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الطالب؟")) del.mutate(s.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">إجمالي: {filtered.length} طالب</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AddStudentDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", student_number: "", class_id: "" });
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({
        full_name: form.full_name,
        student_number: form.student_number || null,
        class_id: form.class_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false); setForm({ full_name: "", student_number: "", class_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> إضافة طالب</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة طالب جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>الاسم الكامل *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>رقم الطالب</Label><Input value={form.student_number} onChange={(e) => setForm({ ...form, student_number: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>الفصل</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الفصل" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => add.mutate()} disabled={!form.full_name || add.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasteImportDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const importMut = useMutation({
    mutationFn: async () => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows = lines.map((line) => {
        // Split by tab, comma, or multiple spaces
        const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        return {
          full_name: parts[0] || line,
          student_number: parts[1] || null,
          class_id: classId || null,
        };
      }).filter((r) => r.full_name);
      if (rows.length === 0) throw new Error("لا توجد أسماء صالحة");
      const { error } = await supabase.from("students").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`تمت إضافة ${n} طالب`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false); setText(""); setClassId("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><ClipboardPaste className="w-4 h-4 ml-1" /> لصق طلاب</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>استيراد طلاب بالنسخ واللصق</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            الصق الأسماء (سطر لكل طالب). يمكنك أيضًا لصق "الاسم، رقم الطالب" مفصولاً بفاصلة أو تاب.
          </p>
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="أحمد محمد علي&#10;فاطمة عبدالله&#10;..." />
          <div className="space-y-2">
            <Label>الفصل (اختياري — يُطبق على جميع الطلاب)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="بدون فصل" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => importMut.mutate()} disabled={!text || importMut.isPending}>استيراد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
