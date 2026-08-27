import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Plus, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_app/positive")({ component: PositivePage });

function PositivePage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const canAdd = role === "admin" || role === "teacher";

  const { data: types = [] } = useQuery({
    queryKey: ["pb-types"],
    queryFn: async () => (await supabase.from("positive_behavior_types").select("*").order("name")).data ?? [],
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["positive-behaviors"],
    queryFn: async () =>
      (await supabase
        .from("positive_behaviors")
        .select("*, students(full_name, classes(name)), positive_behavior_types(name)")
        .order("created_at", { ascending: false })
        .limit(300)).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("positive_behaviors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["positive-behaviors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (rows as any[]).filter(
    (r) => !search || (r.students?.full_name || "").includes(search) || (r.positive_behavior_types?.name || "").includes(search),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-500" /> السلوك الإيجابي
          </h1>
          <p className="text-muted-foreground mt-1">البطاقات الخضراء — رصد السلوكيات المتميزة ومنح نقاط للطالب وصفّه</p>
        </div>
        {canAdd && <AddDialog types={types as any[]} userId={user?.id} />}
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span>سجل السلوك الإيجابي</span>
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم الطالب أو نوع السلوك" className="pr-9" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الطالب</TableHead>
                  <TableHead className="text-right">الفصل</TableHead>
                  <TableHead className="text-right">نوع السلوك</TableHead>
                  <TableHead className="text-right">النقاط</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الملاحظة</TableHead>
                  <TableHead className="text-right">—</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell>
                  </TableRow>
                )}
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-normal break-words">{r.students?.full_name}</TableCell>
                    <TableCell className="whitespace-normal break-words">{r.students?.classes?.name || "—"}</TableCell>
                    <TableCell className="whitespace-normal break-words leading-relaxed">{r.positive_behavior_types?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">+{r.points}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{r.behavior_date}</TableCell>
                    <TableCell className="whitespace-normal break-words text-sm text-muted-foreground">{r.note || "—"}</TableCell>
                    <TableCell>
                      {(role === "admin" || r.created_by === user?.id) && (
                        <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)} aria-label="حذف">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddDialog({ types, userId }: { types: any[]; userId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-of-class", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const t = types.find((x) => x.id === typeId);
      const { error } = await supabase.from("positive_behaviors").insert({
        student_id: studentId,
        type_id: typeId || null,
        points: t?.points ?? 1,
        period: period ? Number(period) : null,
        note: note || null,
        created_by: userId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رصد السلوك الإيجابي");
      setOpen(false);
      setClassId(""); setStudentId(""); setTypeId(""); setPeriod(""); setNote("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 ml-1" /> رصد سلوك إيجابي</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>رصد سلوك إيجابي</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الفصل</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); }}>
              <SelectTrigger><SelectValue placeholder="اختر الفصل" /></SelectTrigger>
              <SelectContent>
                {(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الطالب</Label>
            <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
              <SelectContent>
                {(students as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع السلوك</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="whitespace-normal break-words leading-relaxed">{t.name} (+{t.points})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الحصة (اختياري)</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue placeholder="اختر الحصة" /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => <SelectItem key={p} value={String(p)}>الحصة {p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ملاحظة</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="وصف السلوك المتميز" />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!studentId || !typeId || save.isPending} onClick={() => save.mutate()}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
