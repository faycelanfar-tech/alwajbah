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
import { Upload, Loader2 } from "lucide-react";

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
    </div>
  );
}
