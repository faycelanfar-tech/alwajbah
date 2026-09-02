import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ACTION_OPTIONS, CUSTOM_ACTION, isReadOnlyRole } from "@/lib/branding";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, AlertCircle, CheckCircle2, Copy } from "lucide-react";

export const Route = createFileRoute("/_app/actions")({ component: ActionsPage });

const severityColor: Record<string, string> = {
  "الأولى": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "الثانية": "bg-amber-100 text-amber-700 border-amber-200",
  "الثالثة": "bg-orange-100 text-orange-700 border-orange-200",
  "الرابعة": "bg-rose-100 text-rose-700 border-rose-200",
};

function ActionsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const readOnly = isReadOnlyRole(role);
  useEffect(() => { if (role && role !== "admin" && role !== "supervisor" && !isReadOnlyRole(role)) navigate({ to: "/dashboard" }); }, [role, navigate]);

  const { data: violations = [] } = useQuery({
    queryKey: ["violations-actions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("violations")
        .select("*, students(full_name, classes(name)), violation_types(name, severity)")
        .order("created_at", { ascending: false });
      const list = data ?? [];
      const ids = Array.from(new Set(list.map((v: any) => v.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        list.forEach((v: any) => { v.profiles = map.get(v.created_by) ?? null; });
      }
      return list;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["action-templates"],
    queryFn: async () => (await supabase.from("action_templates").select("*").order("created_at")).data ?? [],
  });
  const options: string[] = templates.length
    ? templates.map((t: any) => t.text)
    : (ACTION_OPTIONS as readonly string[]).slice();

  const pending = violations.filter((v: any) => !v.action_taken);
  const done = violations.filter((v: any) => v.action_taken);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الإجراءات الإدارية</h1>
        <p className="text-muted-foreground mt-1">اتخاذ الإجراء المناسب على المخالفات المرسلة من المعلمين</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="بانتظار إجراء" value={pending.length} icon={<AlertCircle className="w-5 h-5 text-amber-600" />} tone="amber" />
        <StatCard label="تم اتخاذ إجراء" value={done.length} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} tone="emerald" />
        <StatCard label="إجمالي المخالفات" value={violations.length} icon={<ClipboardCheck className="w-5 h-5 text-primary" />} tone="primary" />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">بانتظار إجراء ({pending.length})</TabsTrigger>
          <TabsTrigger value="done">تم اتخاذ إجراء ({done.length})</TabsTrigger>
          {!readOnly && <TabsTrigger value="templates">الإجراءات المحفوظة ({templates.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 && <EmptyState text="لا توجد مخالفات بانتظار الإجراء" />}
          {pending.map((v: any) => <ViolationCard key={v.id} v={v} readOnly={readOnly} options={options} />)}
        </TabsContent>
        <TabsContent value="done" className="space-y-3 mt-4">
          {done.length === 0 && <EmptyState text="لم يتم تسجيل أي إجراء بعد" />}
          {done.map((v: any) => <ViolationCard key={v.id} v={v} readOnly={readOnly} options={options} />)}
        </TabsContent>
        {!readOnly && (
          <TabsContent value="templates" className="mt-4">
            <TemplatesManager templates={templates} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  const bg = tone === "amber" ? "bg-amber-50 border-amber-200" : tone === "emerald" ? "bg-emerald-50 border-emerald-200" : "bg-primary/5 border-primary/20";
  return (
    <Card className={`border ${bg}`}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-muted-foreground py-12">{text}</p>;
}

function ViolationCard({ v, readOnly, options = [] }: { v: any; readOnly?: boolean; options?: string[] }) {
  const qc = useQueryClient();
  const preset = v.action_taken && options.includes(String(v.action_taken).split(" — ")[0])
    ? String(v.action_taken).split(" — ")[0] : (v.action_taken ? CUSTOM_ACTION : "");
  const [action, setAction] = useState<string>(preset);
  const [notes, setNotes] = useState<string>(() => {
    if (!v.action_taken) return "";
    const parts = String(v.action_taken).split(" — ");
    return preset === CUSTOM_ACTION ? String(v.action_taken) : parts.slice(1).join(" — ");
  });

  const save = useMutation({
    mutationFn: async () => {
      const custom = action === CUSTOM_ACTION;
      const final = custom ? notes.trim() : [action, notes.trim()].filter(Boolean).join(" — ");
      if (!final) throw new Error("اكتب أو اختر الإجراء أولاً");
      const { error } = await supabase.from("violations").update({ action_taken: final }).eq("id", v.id);
      if (error) throw error;
      // حفظ نص الإجراء المخصص ليظهر لاحقاً في القائمة المنسدلة
      if (custom) {
        const text = notes.trim();
        if (text.length <= 200 && !options.includes(text)) {
          await supabase.from("action_templates").insert({ text });
        }
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل الإجراء");
      qc.invalidateQueries({ queryKey: ["violations-actions"] });
      qc.invalidateQueries({ queryKey: ["action-templates"] });
      qc.invalidateQueries({ queryKey: ["violations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("violations").update({ action_taken: null }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الإجراء");
      setAction(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["violations-actions"] });
      qc.invalidateQueries({ queryKey: ["violations"] });
    },
  });

  async function copyAction() {
    const text = v.action_taken || (action === CUSTOM_ACTION ? notes : [action, notes].filter(Boolean).join(" — "));
    if (!text) { toast.error("لا يوجد نص للنسخ"); return; }
    try { await navigator.clipboard.writeText(text); toast.success("تم نسخ نص الإجراء"); }
    catch { toast.error("تعذّر النسخ"); }
  }

  return (
    <Card className="border-0 shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold">{v.students?.full_name}</h3>
              {v.students?.classes?.name && <Badge variant="secondary">{v.students.classes.name}</Badge>}
              {v.violation_types?.severity && (
                <Badge variant="outline" className={severityColor[v.violation_types.severity] || ""}>
                  الدرجة {v.violation_types.severity}
                </Badge>
              )}
              {v.period && <Badge variant="outline">الحصة {v.period}</Badge>}
            </div>
            <p className="mt-1 text-sm font-medium text-primary">{v.violation_types?.name || "—"}</p>
            {v.description && <p className="mt-1 text-sm text-muted-foreground break-words">{v.description}</p>}
            <div className="mt-1 text-xs text-muted-foreground flex gap-3 flex-wrap">
              <span>📅 {v.violation_date}</span>
              <span>👤 المعلم: {v.profiles?.full_name || v.profiles?.username || "—"}</span>
            </div>
          </div>
        </div>

        {readOnly ? (
          <div className="pt-2 border-t text-sm">
            <span className="text-muted-foreground">الإجراء المتخذ: </span>
            <span className="font-medium break-words">{v.action_taken || "بانتظار إجراء"}</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-2">
                <Label>الإجراء المتخذ</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
                  <SelectContent>
                    {options.map((a) => <SelectItem key={a} value={a} className="whitespace-normal break-words">{a}</SelectItem>)}
                    <SelectItem value={CUSTOM_ACTION}>✏️ إجراء مخصص (كتابة يدوية)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{action === CUSTOM_ACTION ? "نص الإجراء المخصص *" : "ملاحظات إضافية (اختياري)"}</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={action === CUSTOM_ACTION ? "اكتب أو الصق نص الإجراء هنا..." : "تفاصيل أو ملاحظات..."}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={copyAction}><Copy className="w-4 h-4 ml-1" /> نسخ النص</Button>
              {v.action_taken && (
                <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>إلغاء الإجراء</Button>
              )}
              <Button onClick={() => save.mutate()} disabled={save.isPending || (!action || (action === CUSTOM_ACTION && !notes.trim()))}>
                {v.action_taken ? "تحديث الإجراء" : "حفظ الإجراء"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TemplatesManager({ templates }: { templates: any[] }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const done = () => qc.invalidateQueries({ queryKey: ["action-templates"] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("action_templates").insert({ text: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة الإجراء"); setText(""); done(); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("action_templates").update({ text: value.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تحديث الإجراء"); done(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الإجراء"); done(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>الإجراءات المحفوظة (تظهر في القائمة المنسدلة)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[240px] space-y-2">
            <Label>إضافة إجراء جديد (يمكن اللصق)</Label>
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="الصق أو اكتب نص الإجراء..." />
          </div>
          <Button onClick={() => add.mutate()} disabled={!text.trim() || add.isPending}>إضافة</Button>
        </div>
        <div className="space-y-2">
          {templates.map((t: any) => {
            const value = editing[t.id] ?? t.text;
            return (
              <div key={t.id} className="flex gap-2 items-center border rounded-lg p-2 flex-wrap">
                <Textarea
                  rows={1}
                  className="flex-1 min-w-[200px]"
                  value={value}
                  onChange={(e) => setEditing({ ...editing, [t.id]: e.target.value })}
                />
                <Button size="sm" variant="outline" disabled={value.trim() === t.text || !value.trim()} onClick={() => update.mutate({ id: t.id, value })}>حفظ</Button>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(t.text); toast.success("تم النسخ"); }}><Copy className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove.mutate(t.id)}>حذف</Button>
              </div>
            );
          })}
          {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد إجراءات محفوظة</p>}
        </div>
      </CardContent>
    </Card>
  );
}
