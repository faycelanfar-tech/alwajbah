import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/violations")({ component: ViolationsPage });

const severityColor: Record<string, string> = {
  "خفيفة": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "متوسطة": "bg-amber-100 text-amber-700 border-amber-200",
  "شديدة": "bg-rose-100 text-rose-700 border-rose-200",
};

function ViolationsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: violations = [] } = useQuery({
    queryKey: ["violations"],
    queryFn: async () => (await supabase.from("violations").select("*, students(full_name, classes(name)), violation_types(name, severity), profiles!violations_created_by_fkey(full_name, username)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: types = [] } = useQuery({
    queryKey: ["violation_types"],
    queryFn: async () => (await supabase.from("violation_types").select("*").order("name")).data ?? [],
  });

  const filtered = violations.filter((v: any) =>
    !search || v.students?.full_name?.includes(search) || v.violation_types?.name?.includes(search)
  );

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("violations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["violations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">المخالفات السلوكية</h1>
          <p className="text-muted-foreground mt-1">تسجيل ومتابعة المخالفات</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <ManageTypesDialog types={types} />}
          <AddViolationDialog students={students} types={types} />
        </div>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم الطالب أو نوع المخالفة" className="pr-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد مخالفات</p>}
            {filtered.map((v: any) => {
              const canDelete = isAdmin || v.created_by === user?.id;
              return (
                <div key={v.id} className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{v.students?.full_name}</h3>
                        {v.students?.classes?.name && <Badge variant="secondary">{v.students.classes.name}</Badge>}
                        {v.violation_types?.severity && (
                          <Badge variant="outline" className={severityColor[v.violation_types.severity] || ""}>
                            {v.violation_types.severity}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-primary">{v.violation_types?.name || "—"}</p>
                      {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
                      {v.action_taken && <p className="mt-1 text-sm"><span className="text-muted-foreground">الإجراء:</span> {v.action_taken}</p>}
                      <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
                        <span>📅 {v.violation_date}</span>
                        <span>👤 {v.profiles?.full_name || v.profiles?.username || "—"}</span>
                      </div>
                    </div>
                    {canDelete && (
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف المخالفة؟")) del.mutate(v.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddViolationDialog({ students, types }: { students: any[]; types: any[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "", type_id: "", description: "", action_taken: "",
    violation_date: new Date().toISOString().slice(0, 10),
  });
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("violations").insert({
        student_id: form.student_id,
        type_id: form.type_id || null,
        description: form.description || null,
        action_taken: form.action_taken || null,
        violation_date: form.violation_date,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل المخالفة");
      qc.invalidateQueries({ queryKey: ["violations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({ student_id: "", type_id: "", description: "", action_taken: "", violation_date: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> تسجيل مخالفة</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>تسجيل مخالفة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الطالب *</Label>
            <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
              <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع المخالفة</Label>
            <Select value={form.type_id} onValueChange={(v) => setForm({ ...form, type_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.severity})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>التاريخ</Label><Input type="date" value={form.violation_date} onChange={(e) => setForm({ ...form, violation_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>الوصف</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>الإجراء المتخذ</Label><Input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => add.mutate()} disabled={!form.student_id || add.isPending}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTypesDialog({ types }: { types: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("متوسطة");
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("violation_types").insert({ name, severity }); if (error) throw error; },
    onSuccess: () => { toast.success("تمت الإضافة"); qc.invalidateQueries({ queryKey: ["violation_types"] }); setName(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("violation_types").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["violation_types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Settings className="w-4 h-4 ml-1" /> أنواع المخالفات</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إدارة أنواع المخالفات</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المخالفة" />
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="خفيفة">خفيفة</SelectItem>
                <SelectItem value="متوسطة">متوسطة</SelectItem>
                <SelectItem value="شديدة">شديدة</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => add.mutate()} disabled={!name}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="outline" className={severityColor[t.severity] || ""}>{t.severity}</Badge>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف؟")) del.mutate(t.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
