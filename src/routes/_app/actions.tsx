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
import { ACTION_OPTIONS } from "@/lib/branding";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, AlertCircle, CheckCircle2 } from "lucide-react";

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
  useEffect(() => { if (role && role !== "admin" && role !== "supervisor") navigate({ to: "/dashboard" }); }, [role, navigate]);

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
        </TabsList>
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 && <EmptyState text="لا توجد مخالفات بانتظار الإجراء" />}
          {pending.map((v: any) => <ViolationCard key={v.id} v={v} />)}
        </TabsContent>
        <TabsContent value="done" className="space-y-3 mt-4">
          {done.length === 0 && <EmptyState text="لم يتم تسجيل أي إجراء بعد" />}
          {done.map((v: any) => <ViolationCard key={v.id} v={v} />)}
        </TabsContent>
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

function ViolationCard({ v }: { v: any }) {
  const qc = useQueryClient();
  const [action, setAction] = useState<string>(v.action_taken && (ACTION_OPTIONS as readonly string[]).includes(v.action_taken) ? v.action_taken : "");
  const [notes, setNotes] = useState<string>(
    v.action_taken && !(ACTION_OPTIONS as readonly string[]).includes(v.action_taken) ? v.action_taken : ""
  );

  const save = useMutation({
    mutationFn: async () => {
      const final = [action, notes].filter(Boolean).join(" — ");
      if (!final) throw new Error("اختر الإجراء أولاً");
      const { error } = await supabase.from("violations").update({ action_taken: final }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل الإجراء");
      qc.invalidateQueries({ queryKey: ["violations-actions"] });
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
            {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
            <div className="mt-1 text-xs text-muted-foreground flex gap-3 flex-wrap">
              <span>📅 {v.violation_date}</span>
              <span>👤 المعلم: {v.profiles?.full_name || v.profiles?.username || "—"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-2">
            <Label>الإجراء المتخذ</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder="اختر الإجراء" /></SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات إضافية (اختياري)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل أو ملاحظات..." />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {v.action_taken && (
            <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>إلغاء الإجراء</Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending || !action}>
            {v.action_taken ? "تحديث الإجراء" : "حفظ الإجراء"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
