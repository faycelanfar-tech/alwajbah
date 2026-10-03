import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink } from "lucide-react";

const FOLLOW_ACTIONS = ["توجيه إرشادي", "استدعاء ولي أمر", "اتصال بولي الأمر", "تحويل للموجه الطلابي", "ملاحظة عامة"];

export function StudentQuickDialog({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [action, setAction] = useState(FOLLOW_ACTIONS[0]);
  useEffect(() => { setNote(""); }, [studentId]);

  const { data } = useQuery({
    queryKey: ["student-quick", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [s, v, p, pts] = await Promise.all([
        supabase.from("students").select("id, full_name, student_number, notes, classes(name)").eq("id", studentId!).maybeSingle(),
        supabase.from("violations").select("id, violation_date, description, action_taken, violation_types(name, severity)").eq("student_id", studentId!).order("violation_date", { ascending: false }),
        supabase.from("positive_behaviors").select("id, behavior_date, points, note, positive_behavior_types(name)").eq("student_id", studentId!).order("behavior_date", { ascending: false }),
        (supabase.from as any)("student_points").select("points").eq("student_id", studentId!).maybeSingle(),
      ]);
      return { student: s.data as any, violations: (v.data ?? []) as any[], positives: (p.data ?? []) as any[], points: (pts.data as any)?.points ?? null };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const stamp = new Date().toLocaleDateString("ar-SA");
      const line = `[${stamp}] ${action}: ${note.trim()}`;
      const notes = data?.student?.notes ? `${data.student.notes}\n${line}` : line;
      const { error } = await supabase.from("students").update({ notes }).eq("id", studentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ ملاحظة المتابعة");
      setNote("");
      qc.invalidateQueries({ queryKey: ["student-quick", studentId] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const st = data?.student;
  const history = [
    ...(data?.violations ?? []).map((v) => ({ id: v.id, date: v.violation_date, kind: "neg" as const, title: v.violation_types?.name || "مخالفة", sub: [v.description, v.action_taken && `الإجراء: ${v.action_taken}`].filter(Boolean).join(" — ") })),
    ...(data?.positives ?? []).map((p) => ({ id: p.id, date: p.behavior_date, kind: "pos" as const, title: p.positive_behavior_types?.name || "سلوك إيجابي", sub: [p.note, `+${p.points}`].filter(Boolean).join(" — ") })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Dialog open={!!studentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {st?.full_name ?? "..."}
            {st?.classes?.name && <Badge variant="secondary">{st.classes.name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-destructive/10 p-3"><div className="text-2xl font-bold">{data?.violations.length ?? "—"}</div><div className="text-xs text-muted-foreground">مخالفات</div></div>
          <div className="rounded-lg bg-primary/10 p-3"><div className="text-2xl font-bold">{data?.positives.length ?? "—"}</div><div className="text-xs text-muted-foreground">سلوك إيجابي</div></div>
          <div className="rounded-lg bg-secondary p-3"><div className="text-2xl font-bold">{data?.points ?? "—"}</div><div className="text-xs text-muted-foreground">رصيد النقاط</div></div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">السجل السلوكي</h3>
          <div className="max-h-60 overflow-y-auto space-y-1.5 pe-1">
            {history.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد سجل</p>}
            {history.map((h) => (
              <div key={h.kind + h.id} className={`rounded-md border-s-4 bg-card border p-2 text-sm ${h.kind === "neg" ? "border-s-destructive" : "border-s-primary"}`}>
                <div className="flex justify-between gap-2"><span className="font-medium">{h.title}</span><span className="text-xs text-muted-foreground">{h.date}</span></div>
                {h.sub && <div className="text-xs text-muted-foreground mt-0.5">{h.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">ملاحظات المتابعة</h3>
          {st?.notes && <pre className="whitespace-pre-wrap text-xs bg-muted rounded-md p-2 max-h-32 overflow-y-auto font-sans">{st.notes}</pre>}
          <div className="flex gap-2">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{FOLLOW_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب المشكلة أو ما تم الاتفاق عليه..." rows={2} />
          <div className="flex justify-between">
            {studentId && (
              <Link to="/students/$id" params={{ id: studentId }} onClick={onClose}>
                <Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4 ms-1" /> البطاقة الكاملة</Button>
              </Link>
            )}
            <Button size="sm" disabled={!note.trim() || save.isPending} onClick={() => save.mutate()}>حفظ الملاحظة</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
