import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { PagePermissionsCard } from "@/components/page-permissions-card";


export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { role } = useAuth();
  const { settings, refresh } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);
  useEffect(() => { if (role && role !== "admin") navigate({ to: "/dashboard" }); }, [role, navigate]);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").update({
        school_name: form.school_name,
        subtitle: form.subtitle,
        logo_url: form.logo_url,
      }).eq("id", 1);
      if (error) throw error;
      toast.success("تم حفظ الإعدادات");
      await refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setForm({ ...form, logo_url: data.publicUrl });
      toast.success("تم رفع الشعار — لا تنس الحفظ");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">تخصيص النظام</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>هوية المدرسة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!form.school_name?.trim() && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              لم يتم تعيين اسم المدرسة بعد. أضِف اسم مدرستك وشعارها ليظهرا في كل الصفحات والتقارير.
            </div>
          )}
          <div className="space-y-2"><Label>اسم المدرسة *</Label><Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} placeholder="مثال: مدرسة النور الابتدائية" /></div>
          <div className="space-y-2"><Label>العنوان الفرعي</Label><Input value={form.subtitle || ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>

          <div className="space-y-2">
            <Label>شعار المدرسة</Label>
            <div className="flex items-center gap-4">
              {form.logo_url && <img src={form.logo_url} alt="" className="w-20 h-20 rounded-lg object-contain bg-secondary p-2 border" />}
              <label className="flex-1">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-secondary/50 transition-colors">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Upload className="w-5 h-5 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground mt-2">اختر صورة للشعار</p></>}
                </div>
              </label>
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="lg" className="w-full">
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ التغييرات
          </Button>
        </CardContent>
      </Card>

      <SubjectsCard />

      <TermsCard />

      <GradingCard />

      <PagePermissionsCard />
    </div>

  );
}

function SubjectsCard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("sort_order")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subjects").insert({ name: name.trim(), sort_order: subjects.length });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت إضافة المادة"); setName(""); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("subjects").update({ name: value.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تعديل المادة"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const [{ count: repCount }, { count: teachCount }] = await Promise.all([
        supabase.from("academic_reports").select("id", { count: "exact", head: true }).eq("subject_id", id),
        supabase.from("teacher_subjects").select("id", { count: "exact", head: true }).eq("subject_id", id),
      ]);
      if ((repCount ?? 0) > 0) throw new Error("لا يمكن حذف هذه المادة لأنها مرتبطة برصد أكاديمي");
      if ((teachCount ?? 0) > 0) throw new Error("لا يمكن حذف هذه المادة لأنها مسندة إلى معلم");
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw new Error("تعذّر الحذف — المادة مرتبطة ببيانات أخرى");
    },
    onSuccess: () => { toast.success("تم حذف المادة"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const a = subjects[index] as any;
      const b = subjects[index + dir] as any;
      if (!a || !b) return;
      const { error: e1 } = await supabase.from("subjects").update({ sort_order: b.sort_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("subjects").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>المواد الدراسية</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المادة" />
          <Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending}>إضافة</Button>
        </div>
        <div className="space-y-2">
          {subjects.map((s: any, i: number) => {
            const value = edits[s.id] ?? s.name;
            return (
              <div key={s.id} className="flex items-center gap-2 border rounded-lg p-2">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-5 w-6" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ index: i, dir: -1 })} aria-label="أعلى">
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-6" disabled={i === subjects.length - 1 || move.isPending} onClick={() => move.mutate({ index: i, dir: 1 })} aria-label="أسفل">
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                <Input value={value} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} className="flex-1" />
                <Button variant="outline" size="sm" disabled={!value.trim() || value.trim() === s.name} onClick={() => rename.mutate({ id: s.id, value })}>حفظ</Button>
                <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
          {subjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد مواد بعد</p>}
        </div>

      </CardContent>
    </Card>
  );
}


function TermsCard() {
  const { refresh } = useSettings();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });

  const { data: terms = [] } = useQuery({
    queryKey: ["academic_terms"],
    queryFn: async () => (await supabase.from("academic_terms").select("*").order("start_date")).data ?? [],
  });

  const done = async (msg: string) => {
    toast.success(msg);
    await qc.invalidateQueries({ queryKey: ["academic_terms"] });
    await refresh();
  };

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("academic_terms").insert({
        name: form.name.trim(), start_date: form.start_date, end_date: form.end_date,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ name: "", start_date: "", end_date: "" }); done("تمت إضافة الفصل الدراسي"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("academic_terms").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => done("تم الحفظ"),
    onError: (e: any) => toast.error(e.message),
  });

  const setCurrent = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("academic_terms").update({ is_current: false }).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("academic_terms").update({ is_current: true }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => done("تم تحديد الفصل الحالي"),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => done("تم حذف الفصل الدراسي"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>مواعيد الفصول الدراسية</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الفصل" />
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Button onClick={() => add.mutate()} disabled={!form.name.trim() || !form.start_date || !form.end_date || add.isPending}>
            إضافة
          </Button>
        </div>
        <div className="space-y-2">
          {terms.map((t: any) => (
            <div key={t.id} className="border rounded-lg p-2 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
              <Input defaultValue={t.name} onBlur={(e) => e.target.value.trim() !== t.name && update.mutate({ id: t.id, patch: { name: e.target.value.trim() } })} />
              <Input type="date" defaultValue={t.start_date} onBlur={(e) => e.target.value !== t.start_date && update.mutate({ id: t.id, patch: { start_date: e.target.value } })} />
              <Input type="date" defaultValue={t.end_date} onBlur={(e) => e.target.value !== t.end_date && update.mutate({ id: t.id, patch: { end_date: e.target.value } })} />
              <Button variant={t.is_current ? "default" : "outline"} size="sm" onClick={() => setCurrent.mutate(t.id)}>
                {t.is_current ? "الفصل الحالي" : "تعيين كحالي"}
              </Button>
              <Button variant="ghost" size="sm" className="text-rose-600 justify-self-start" onClick={() => remove.mutate(t.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {terms.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لم تتم إضافة فصول دراسية بعد</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function GradingCard() {
  const { refresh } = useSettings();
  const qc = useQueryClient();

  const { data: levels = [] } = useQuery({
    queryKey: ["grading_levels"],
    queryFn: async () => (await supabase.from("grading_levels").select("*").order("sort_order")).data ?? [],
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("grading_levels").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حفظ نظام التصحيح");
      await qc.invalidateQueries({ queryKey: ["grading_levels"] });
      await refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>نظام التصحيح الأكاديمي</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">تُستخدم هذه المستويات وألوانها وحدود درجاتها في الرصد الأكاديمي وكل التقارير.</p>
        {levels.map((l: any) => (
          <div key={l.id} className="border rounded-lg p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="space-y-1">
              <Label className="text-xs">المستوى</Label>
              <Input defaultValue={l.label} onBlur={(e) => e.target.value.trim() !== l.label && update.mutate({ id: l.id, patch: { label: e.target.value.trim() } })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">اللون</Label>
              <Input type="color" className="h-10 p-1" defaultValue={l.color} onBlur={(e) => e.target.value !== l.color && update.mutate({ id: l.id, patch: { color: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">من درجة</Label>
              <Input type="number" defaultValue={l.min_score} onBlur={(e) => Number(e.target.value) !== l.min_score && update.mutate({ id: l.id, patch: { min_score: Number(e.target.value) } })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى درجة</Label>
              <Input type="number" defaultValue={l.max_score} onBlur={(e) => Number(e.target.value) !== l.max_score && update.mutate({ id: l.id, patch: { max_score: Number(e.target.value) } })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
