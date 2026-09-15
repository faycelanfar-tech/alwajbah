import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { esc, printHtml } from "@/lib/academic-print";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, RotateCcw, Printer, FileSpreadsheet, History, Trash2 } from "lucide-react";

const BONUS = 5;
const PENALTY_REASONS = [
  "ضعف المشاركة",
  "سوء السلوك",
  "عدم إحضار الكتاب المدرسي",
  "عدم إنجاز الواجب",
];
const CUSTOM = "__custom__";

type Cycle = {
  id: string; teacher_id: string; class_id: string; label: string | null;
  period_type: string; start_date: string; end_date: string | null; is_active: boolean; base_score: number;
};
type Entry = {
  id: string; cycle_id: string; student_id: string; delta: number; kind: string;
  reason: string | null; note: string | null; period: number | null; created_at: string;
};

export function ParticipationPanel() {
  const { user, role, isOwner } = useAuth();
  const { settings, displayName } = useSettings();
  const qc = useQueryClient();
  const isAdmin = role === "admin" || isOwner;
  const [classId, setClassId] = useState("");
  const [bonusFor, setBonusFor] = useState<{ id: string; name: string } | null>(null);
  const [penaltyFor, setPenaltyFor] = useState<{ id: string; name: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const { data: myClasses = [] } = useQuery({
    queryKey: ["participation-classes", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      if (isAdmin) {
        return (await supabase.from("classes").select("id, name").order("name")).data ?? [];
      }
      const { data } = await supabase
        .from("teacher_classes")
        .select("class_id, classes(id, name)")
        .eq("user_id", user!.id);
      return (data ?? [])
        .map((r: any) => r.classes)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar"));
    },
  });

  const selectedClass = (myClasses as any[]).find((c) => c.id === classId);

  const { data: cycle } = useQuery({
    queryKey: ["participation-cycle", user?.id, classId],
    enabled: !!user?.id && !!classId,
    queryFn: async () => {
      const { data } = await supabase
        .from("participation_cycles")
        .select("*")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId)
        .eq("is_active", true)
        .maybeSingle();
      return (data as Cycle) ?? null;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["participation-students", classId],
    enabled: !!classId,
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name").eq("class_id", classId).order("full_name")).data ?? [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["participation-entries", cycle?.id],
    enabled: !!cycle?.id,
    queryFn: async () =>
      ((await supabase.from("participation_entries").select("*").eq("cycle_id", cycle!.id).order("created_at", { ascending: false })).data ??
        []) as Entry[],
  });

  const { data: types = [] } = useQuery({
    queryKey: ["pb-types"],
    queryFn: async () => (await supabase.from("positive_behavior_types").select("id, name").order("name")).data ?? [],
  });

  const { data: archive = [] } = useQuery({
    queryKey: ["participation-archive", user?.id, classId],
    enabled: !!user?.id && !!classId,
    queryFn: async () =>
      ((await supabase
        .from("participation_cycles")
        .select("*")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId)
        .eq("is_active", false)
        .order("start_date", { ascending: false })
        .limit(12)).data ?? []) as Cycle[],
  });

  const base = cycle?.base_score ?? 10;
  const rows = useMemo(() => {
    return (students as any[])
      .map((s) => {
        const mine = (entries as Entry[]).filter((e) => e.student_id === s.id);
        return {
          id: s.id,
          name: s.full_name as string,
          score: base + mine.reduce((a, e) => a + e.delta, 0),
          bonuses: mine.filter((e) => e.delta > 0).length,
          penalties: mine.filter((e) => e.delta < 0).length,
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ar"));
  }, [students, entries, base]);

  const startCycle = useMutation({
    mutationFn: async ({ classIds, periodType }: { classIds: string[]; periodType: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error: e1 } = await supabase
        .from("participation_cycles")
        .update({ is_active: false, end_date: today })
        .eq("teacher_id", user!.id)
        .eq("is_active", true)
        .in("class_id", classIds);
      if (e1) throw e1;
      const { error } = await supabase.from("participation_cycles").insert(
        classIds.map((cid) => ({
          teacher_id: user!.id,
          class_id: cid,
          period_type: periodType,
          start_date: today,
          base_score: 10,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم بدء دورة جديدة");
      setResetOpen(false);
      qc.invalidateQueries({ queryKey: ["participation-cycle"] });
      qc.invalidateQueries({ queryKey: ["participation-entries"] });
      qc.invalidateQueries({ queryKey: ["participation-archive"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addEntry = useMutation({
    mutationFn: async (row: { student_id: string; delta: number; kind: string; reason?: string; note?: string; period?: number | null }) => {
      let cid = cycle?.id;
      if (!cid) {
        const { data, error } = await supabase
          .from("participation_cycles")
          .insert({ teacher_id: user!.id, class_id: classId, period_type: "weekly", base_score: 10 })
          .select("*")
          .single();
        if (error) throw error;
        cid = (data as Cycle).id;
        qc.setQueryData(["participation-cycle", user?.id, classId], data);
      }
      const { error } = await supabase.from("participation_entries").insert({
        cycle_id: cid,
        student_id: row.student_id,
        delta: row.delta,
        kind: row.kind,
        reason: row.reason ?? null,
        note: row.note ?? null,
        period: row.period ?? null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التسجيل");
      setBonusFor(null);
      setPenaltyFor(null);
      qc.invalidateQueries({ queryKey: ["participation-cycle"] });
      qc.invalidateQueries({ queryKey: ["participation-entries"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("participation_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["participation-entries"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const periodLabel = cycle
    ? `${cycle.period_type === "monthly" ? "دورة شهرية" : cycle.period_type === "custom" ? "دورة مخصصة" : "دورة أسبوعية"} — من ${cycle.start_date}`
    : "لم تبدأ دورة بعد";

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r, i) => ({
        الترتيب: i + 1,
        الطالب: r.name,
        الدرجة: r.score,
        "عدد التحفيزات": r.bonuses,
        "عدد الخصومات": r.penalties,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "درجات المشاركة");
    XLSX.writeFile(wb, `درجات_المشاركة_${selectedClass?.name ?? ""}.xlsx`);
  }

  function printReport() {
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>تقرير درجات المشاركة</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: "Segoe UI", Tahoma, sans-serif; color:#111; }
header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #1d4ed8; padding-bottom:8px; margin-bottom:14px; }
header img { height:56px; }
h1 { font-size:18px; margin:0; }
.meta { font-size:12px; color:#555; margin-top:4px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th, td { border:1px solid #cbd5e1; padding:6px 8px; text-align:right; }
th { background:#eff6ff; }
tr.top1 td { background:#fef9c3; font-weight:700; }
tr.top2 td { background:#f1f5f9; font-weight:700; }
tr.top3 td { background:#fff7ed; font-weight:700; }
</style></head><body>
<header>${settings.logo_url ? `<img src="${esc(settings.logo_url)}" />` : ""}
<div><h1>${esc(displayName)} — تقرير درجات المشاركة</h1>
<div class="meta">المعلم: ${esc(user?.email?.split("@")[0] ?? "")} · الصف: ${esc(selectedClass?.name ?? "")} · ${esc(periodLabel)} · التاريخ: ${new Date().toLocaleDateString("ar")}</div></div>
</header>
<table><thead><tr><th>#</th><th>الطالب</th><th>الدرجة</th><th>التحفيزات</th><th>الخصومات</th></tr></thead><tbody>
${rows
  .map(
    (r, i) =>
      `<tr class="${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${r.bonuses}</td><td>${r.penalties}</td></tr>`,
  )
  .join("")}
</tbody></table>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;
    printHtml(html);
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>درجات المشاركة في الحصة</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
                <SelectContent>
                  {(myClasses as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={!classId} onClick={() => setResetOpen(true)}>
                <RotateCcw className="w-4 h-4 ml-1" /> بدء دورة جديدة
              </Button>
              <Button variant="outline" disabled={!classId || rows.length === 0} onClick={printReport}>
                <Printer className="w-4 h-4 ml-1" /> طباعة
              </Button>
              <Button variant="outline" disabled={!classId || rows.length === 0} onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 ml-1" /> إكسل
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!classId && <p className="text-muted-foreground text-sm">اختر أحد صفوفك لعرض درجات الطلاب.</p>}
          {classId && (
            <>
              <p className="text-sm text-muted-foreground">
                {periodLabel} · كل طالب يبدأ بـ {base} درجات، وكل تحفيز +{BONUS}
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">الدرجة</TableHead>
                      <TableHead className="text-right">التحفيزات</TableHead>
                      <TableHead className="text-right">الخصومات</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا يوجد طلاب في هذا الصف</TableCell></TableRow>
                    )}
                    {rows.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium whitespace-normal break-words">{r.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={r.score >= base ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                            {r.score}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.bonuses}</TableCell>
                        <TableCell>{r.penalties}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => setBonusFor({ id: r.id, name: r.name })}>
                              <Plus className="w-4 h-4" /> {BONUS}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPenaltyFor({ id: r.id, name: r.name })}>
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setHistoryFor({ id: r.id, name: r.name })} aria-label="السجل">
                              <History className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {archive.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  الدورات السابقة المحفوظة: {archive.map((c) => `${c.start_date} → ${c.end_date ?? ""}`).join(" · ")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <BonusDialog
        target={bonusFor}
        types={types as any[]}
        onClose={() => setBonusFor(null)}
        onSave={(v) => addEntry.mutate({ student_id: bonusFor!.id, delta: BONUS, kind: "bonus", ...v })}
        pending={addEntry.isPending}
      />
      <PenaltyDialog
        target={penaltyFor}
        onClose={() => setPenaltyFor(null)}
        onSave={(v) => addEntry.mutate({ student_id: penaltyFor!.id, delta: -Math.abs(v.points), kind: "penalty", reason: v.reason, note: v.note })}
        pending={addEntry.isPending}
      />

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>سجل درجات {historyFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(entries as Entry[]).filter((e) => e.student_id === historyFor?.id).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد حركات في هذه الدورة</p>
            )}
            {(entries as Entry[])
              .filter((e) => e.student_id === historyFor?.id)
              .map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 border rounded-md p-2">
                  <div className="text-sm">
                    <span className={e.delta > 0 ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </span>{" "}
                    {e.reason || (e.delta > 0 ? "تحفيز" : "خصم")}
                    {e.period ? ` — الحصة ${e.period}` : ""}
                    {e.note ? <div className="text-muted-foreground">{e.note}</div> : null}
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("ar")}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => delEntry.mutate(e.id)} aria-label="حذف">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        className_={selectedClass?.name}
        pending={startCycle.isPending}
        onConfirm={(scope, periodType) =>
          startCycle.mutate({
            classIds: scope === "all" ? (myClasses as any[]).map((c) => c.id) : [classId],
            periodType,
          })
        }
      />
    </div>
  );
}

function BonusDialog({
  target, types, onClose, onSave, pending,
}: {
  target: { id: string; name: string } | null;
  types: any[];
  onClose: () => void;
  onSave: (v: { reason?: string; note?: string; period?: number | null }) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) { onClose(); setReason(""); setPeriod(""); setNote(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>تحفيز {target?.name} (+{BONUS})</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>نوع التحفيز (اختياري)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                <SelectItem value="مشاركة متميزة">مشاركة متميزة</SelectItem>
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
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => onSave({ reason: reason || undefined, note: note || undefined, period: period ? Number(period) : null })}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PenaltyDialog({
  target, onClose, onSave, pending,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  onSave: (v: { points: number; reason: string; note?: string }) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState(PENALTY_REASONS[0]);
  const [custom, setCustom] = useState("");
  const [points, setPoints] = useState("1");
  const [note, setNote] = useState("");
  const finalReason = reason === CUSTOM ? custom.trim() : reason;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) { onClose(); setCustom(""); setNote(""); setPoints("1"); setReason(PENALTY_REASONS[0]); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>خصم درجات {target?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>السبب</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PENALTY_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                <SelectItem value={CUSTOM}>سبب مخصص…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reason === CUSTOM && (
            <div className="space-y-2">
              <Label>اكتب السبب</Label>
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="مثال: إزعاج زملائه" />
            </div>
          )}
          <div className="space-y-2">
            <Label>عدد الدرجات المخصومة</Label>
            <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ملاحظة</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending || !finalReason || !Number(points)}
            onClick={() => onSave({ points: Number(points), reason: finalReason, note: note || undefined })}
          >
            خصم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({
  open, onOpenChange, className_, pending, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  className_?: string;
  pending: boolean;
  onConfirm: (scope: "class" | "all", periodType: string) => void;
}) {
  const [scope, setScope] = useState<"class" | "all">("class");
  const [periodType, setPeriodType] = useState("weekly");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>بدء دورة جديدة (تصفير الدرجات)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">تُحفظ الدورة الحالية كأرشيف، وتعود درجات جميع الطلاب إلى 10.</p>
          <div className="space-y-2">
            <Label>النطاق</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">الصف الحالي{className_ ? ` (${className_})` : ""}</SelectItem>
                <SelectItem value="all">جميع صفوفي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>مدة الدورة</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">أسبوعية</SelectItem>
                <SelectItem value="monthly">شهرية</SelectItem>
                <SelectItem value="custom">مخصصة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => onConfirm(scope, periodType)}>بدء الدورة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
