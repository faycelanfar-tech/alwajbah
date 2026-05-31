import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminResetUserPassword } from "@/lib/password.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, KeyRound, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

import { toast } from "sonner";

export const Route = createFileRoute("/_app/teachers")({ component: TeachersPage });

function TeachersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", email: "" });
  const [resetUser, setResetUser] = useState<{ id: string; username: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const resetFn = useServerFn(adminResetUserPassword);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => ({ ...p, role: roles?.find((r) => r.user_id === p.id)?.role || "teacher" }));
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const email = `${form.username.toLowerCase().trim()}@alwajbah.local`;
      const { data, error } = await supabase.auth.signUp({
        email, password: form.password,
        options: { data: { username: form.username.toLowerCase().trim(), full_name: form.full_name } },
      });
      if (error) throw error;
      // Save real email on profile for password recovery
      if (form.email && data.user) {
        await supabase.from("profiles").update({ email: form.email.trim() }).eq("id", data.user.id);
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب المعلم");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false); setForm({ username: "", full_name: "", password: "", email: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doReset = useMutation({
    mutationFn: async () => {
      if (!resetUser) return;
      await resetFn({ data: { userId: resetUser.id, newPassword: newPwd } });
    },
    onSuccess: () => {
      toast.success(`تم تعيين كلمة المرور لـ @${resetUser?.username}`);
      setResetUser(null); setNewPwd("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المعلمون</h1>
          <p className="text-muted-foreground mt-1">حسابات المستخدمين بالنظام</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> إضافة معلم</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة حساب معلم</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>الاسم الكامل *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>اسم المستخدم *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="بالإنجليزية بدون مسافات" /></div>
              <div className="space-y-2"><Label>البريد الإلكتروني (اختياري لاستعادة كلمة المرور)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@example.com" /></div>
              <div className="space-y-2"><Label>كلمة المرور *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} /></div>
              <p className="text-xs text-muted-foreground">⚠️ بعد الحفظ قد يتم تسجيل دخولك بحساب المعلم الجديد. سجّل خروج وادخل مرة أخرى بحسابك.</p>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={!form.username || !form.password || !form.full_name}>إنشاء</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u: { id: string; username: string; full_name: string | null; email: string | null; role: string }) => (
          <Card key={u.id} className="border-0 shadow-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {(u.full_name || u.username).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{u.full_name || u.username}</p>
                  <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                  {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                </div>
                <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                  {u.role === "admin" ? "مدير" : "معلم"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setResetUser({ id: u.id, username: u.username })}>
                <KeyRound className="w-4 h-4 ml-1" /> إعادة تعيين كلمة المرور
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور لـ @{resetUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>كلمة المرور الجديدة</Label>
            <Input type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="6 أحرف على الأقل" minLength={6} />
            <p className="text-xs text-muted-foreground">اكتب كلمة المرور الجديدة وأعطها للمعلم.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => doReset.mutate()} disabled={newPwd.length < 6 || doReset.isPending}>تعيين</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
