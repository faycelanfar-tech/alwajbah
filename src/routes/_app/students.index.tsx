import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ClipboardPaste, Search, Eye, Pencil, FileSpreadsheet, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/students/")({ component: StudentsPage });

function StudentsPage() {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "supervisor";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmOne, setConfirmOne] = useState<any | null>(null);
  const [moveClass, setMoveClass] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("*, classes(name)").order("full_name")).data ?? [],
  });

  const filtered = students.filter((s: any) => {
    const q = search.trim();
    const matchSearch =
      !q || s.full_name.includes(q) || (s.student_number || "").includes(q) || (s.classes?.name || "").includes(q);
    const matchClass = filterClass === "all" || s.class_id === filterClass;
    return matchSearch && matchClass;
  });

  const selectedIdsArr = [...selected];

  const { data: linkedCount = 0 } = useQuery({
    queryKey: ["students-linked", selectedIdsArr.sort().join(",")],
    enabled: confirmBulk && selectedIdsArr.length > 0,
    queryFn: async () => {
      const [v, p] = await Promise.all([
        supabase.from("violations").select("id", { count: "exact", head: true }).in("student_id", selectedIdsArr),
        supabase.from("positive_behaviors").select("id", { count: "exact", head: true }).in("student_id", selectedIdsArr),
      ]);
      return (v.count ?? 0) + (p.count ?? 0);
    },
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => { const { error } = await supabase.from("students").delete().in("id", ids); if (error) throw error; return ids.length; },
    onSuccess: (n) => {
      toast.success(n === 1 ? "تم الحذف" : `تم حذف ${n} طالب`);
      setSelected(new Set()); setConfirmBulk(false); setConfirmOne(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").update({ class_id: moveClass }).in("id", selectedIdsArr);
      if (error) throw error;
      return selectedIdsArr.length;
    },
    onSuccess: (n) => {
      toast.success(`تم نقل ${n} طالب`);
      setSelected(new Set()); setMoveClass("");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportExcel = () => {
    const rows = filtered.map((s: any) => ({
      "الاسم": s.full_name,
      "رقم الطالب": s.student_number || "",
      "الفصل": s.classes?.name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, `الطلاب-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredIds = filtered.map((s: any) => s.id as string);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filteredIds));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">الطلاب</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات الطلاب</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
          </Button>
          {canManage && (
            <>
              <PasteImportDialog classes={classes} existing={students} />
              <AddStudentDialog classes={classes} />
            </>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الفصل" className="pr-9" />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفصول</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canManage && selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm">تم تحديد {selected.size} طالب</span>
              <div className="flex gap-2 items-center flex-wrap">
                <Select value={moveClass} onValueChange={setMoveClass}>
                  <SelectTrigger className="w-40 h-9"><SelectValue placeholder="نقل إلى فصل" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={!moveClass || move.isPending} onClick={() => move.mutate()}>
                  <ArrowLeftRight className="w-4 h-4 ml-1" /> نقل
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmBulk(true)}>
                  <Trash2 className="w-4 h-4 ml-1" /> حذف المحدد
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  {canManage && (
                    <th className="p-3 w-10 text-center">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="تحديد الكل" />
                    </th>
                  )}
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold">رقم الطالب</th>
                  <th className="text-right p-3 font-semibold">الفصل</th>
                  <th className="text-center p-3 font-semibold w-32">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground py-10">
                      <p className="mb-3">{students.length === 0 ? "لا يوجد طلاب بعد" : "لا توجد نتائج مطابقة للبحث"}</p>
                      {students.length === 0 && canManage
                        ? <PasteImportDialog classes={classes} existing={students} />
                        : students.length > 0 && (
                          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterClass("all"); }}>مسح التصفية</Button>
                        )}
                    </td>
                  </tr>
                )}
                {filtered.map((s: any) => (
                  <tr key={s.id} className={`border-t hover:bg-secondary/30 ${selected.has(s.id) ? "bg-primary/5" : ""}`}>
                    {canManage && (
                      <td className="p-3 text-center">
                        <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} aria-label={`تحديد ${s.full_name}`} />
                      </td>
                    )}
                    <td className="p-3 font-medium">{s.full_name}</td>
                    <td className="p-3 text-muted-foreground">{s.student_number || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.classes?.name || "—"}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Link to="/students/$id" params={{ id: s.id }}>
                          <Button size="icon" variant="ghost" title="بطاقة الطالب"><Eye className="w-4 h-4 text-primary" /></Button>
                        </Link>
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" title="تعديل" onClick={() => setEditing(s)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="حذف" onClick={() => setConfirmOne(s)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">إجمالي: {filtered.length} طالب</p>
        </CardContent>
      </Card>

      <EditStudentDialog student={editing} classes={classes} onClose={() => setEditing(null)} />

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {selected.size} طالب نهائيًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedCount > 0
                ? `سيتم أيضًا حذف ${linkedCount} سجل مرتبط (مخالفات وسلوك إيجابي). لا يمكن التراجع.`
                : "لا توجد سجلات مرتبطة بهؤلاء الطلاب. لا يمكن التراجع عن الحذف."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => del.mutate(selectedIdsArr)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmOne} onOpenChange={(o) => !o && setConfirmOne(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطالب {confirmOne?.full_name}؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف سجلاته المرتبطة أيضًا ولا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => del.mutate([confirmOne.id])}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddStudentDialog({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", student_number: "", class_id: "" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({
        full_name: form.full_name,
        student_number: form.student_number || null,
        class_id: form.class_id || null,
        created_by: user?.id ?? null,
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

function EditStudentDialog({ student, classes, onClose }: { student: any | null; classes: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", student_number: "", class_id: "" });
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (student && student.id !== loadedId) {
    setLoadedId(student.id);
    setForm({ full_name: student.full_name ?? "", student_number: student.student_number ?? "", class_id: student.class_id ?? "" });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").update({
        full_name: form.full_name,
        student_number: form.student_number || null,
        class_id: form.class_id || null,
      }).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديل");
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل بيانات الطالب</DialogTitle></DialogHeader>
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
          <Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasteImportDialog({ classes, existing }: { classes: any[]; existing: any[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [classId, setClassId] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();
  const importMut = useMutation({
    mutationFn: async () => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const parsed = lines.map((line) => {
        const parts = line.split(/\t|,|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        return {
          full_name: parts[0] || line,
          student_number: parts[1] || null,
          class_id: classId || null,
        };
      }).filter((r) => r.full_name);
      if (parsed.length === 0) throw new Error("لا توجد أسماء صالحة");

      const seen = new Set<string>();
      const rows = parsed.filter((r) => {
        const key = `${r.full_name}|${r.class_id ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return !existing.some((s: any) => s.full_name === r.full_name && (s.class_id ?? null) === r.class_id);
      });
      const skipped = parsed.length - rows.length;
      if (rows.length === 0) throw new Error("جميع الأسماء موجودة مسبقًا في هذا الفصل");
      const { error } = await supabase.from("students").insert(rows);
      if (error) throw error;
      return { added: rows.length, skipped };
    },
    onSuccess: ({ added, skipped }) => {
      toast.success(skipped > 0 ? `تمت إضافة ${added} طالب — وتم تجاهل ${skipped} مكرر` : `تمت إضافة ${added} طالب`);
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
            الصق الأسماء (سطر لكل طالب). يمكنك أيضًا لصق "الاسم، رقم الطالب" مفصولاً بفاصلة أو تاب. الأسماء المكررة في نفس الفصل يتم تجاهلها.
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
