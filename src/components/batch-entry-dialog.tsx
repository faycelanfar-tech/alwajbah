import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

export function BatchEntryDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"pos" | "neg">("pos");
  const [classId, setClassId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], enabled: open, queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [] });
  const { data: students = [] } = useQuery({ queryKey: ["students"], enabled: open, queryFn: async () => (await supabase.from("students").select("*, classes(name)").order("full_name")).data ?? [] });
  const { data: posTypes = [] } = useQuery({ queryKey: ["positive-types"], enabled: open, queryFn: async () => (await supabase.from("positive_behavior_types").select("*").order("name")).data ?? [] });
  const { data: negTypes = [] } = useQuery({ queryKey: ["violation-types"], enabled: open, queryFn: async () => (await supabase.from("violation_types").select("*").order("name")).data ?? [] });

  const list = useMemo(() => (students as any[]).filter((s) => s.class_id === classId), [students, classId]);
  const types = (kind === "pos" ? posTypes : negTypes) as any[];
  const allOn = list.length > 0 && list.every((s) => sel.has(s.id));

  const reset = () => { setSel(new Set()); setTypeId(""); setNote(""); };

  const save = useMutation({
    mutationFn: async () => {
      const ids = [...sel];
      if (kind === "pos") {
        const t = posTypes.find((x: any) => x.id === typeId) as any;
        const { error } = await supabase.from("positive_behaviors").insert(ids.map((student_id) => ({
          student_id, type_id: typeId || null, note: note || null, points: t?.points ?? 1, behavior_date: date, created_by: user!.id,
        })));
        if (error) throw error;
      } else {
        const { error } = await supabase.from("violations").insert(ids.map((student_id) => ({
          student_id, type_id: typeId || null, description: note || null, violation_date: date, created_by: user!.id,
        })));
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`تم التسجيل لـ ${n} طالب`);
      ["violations", "dashboard-stats", "early-warning", "student_points", "positive_behaviors"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      reset(); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Users className="w-4 h-4 ms-1" /> إدخال جماعي</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>إدخال جماعي لمجموعة طلاب</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button variant={kind === "pos" ? "default" : "outline"} onClick={() => { setKind("pos"); setTypeId(""); }}>سلوك إيجابي ⭐</Button>
          <Button variant={kind === "neg" ? "destructive" : "outline"} onClick={() => { setKind("neg"); setTypeId(""); }}>مخالفة</Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>الفصل</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSel(new Set()); }}>
              <SelectTrigger><SelectValue placeholder="اختر الفصل" /></SelectTrigger>
              <SelectContent>{(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{kind === "pos" ? "نوع السلوك" : "نوع المخالفة"}</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{kind === "pos" && t.points ? ` (+${t.points})` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري) — مثل: المشاركة في نشاط الإذاعة" />

        {classId && (
          <div className="border rounded-lg">
            <label className="flex items-center gap-2 p-2 border-b bg-muted/50 text-sm font-medium cursor-pointer">
              <Checkbox checked={allOn} onCheckedChange={(c) => setSel(c ? new Set(list.map((s) => s.id)) : new Set())} />
              تحديد الكل ({sel.size}/{list.length})
            </label>
            <div className="max-h-64 overflow-y-auto grid sm:grid-cols-2">
              {list.map((s) => (
                <label key={s.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-secondary/40">
                  <Checkbox checked={sel.has(s.id)} onCheckedChange={(c) => { const n = new Set(sel); c ? n.add(s.id) : n.delete(s.id); setSel(n); }} />
                  {s.full_name}
                </label>
              ))}
              {list.length === 0 && <p className="p-3 text-sm text-muted-foreground">لا يوجد طلاب في هذا الفصل</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button disabled={sel.size === 0 || !typeId || save.isPending} onClick={() => save.mutate()} variant={kind === "neg" ? "destructive" : "default"}>
            تسجيل لـ {sel.size} طالب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
