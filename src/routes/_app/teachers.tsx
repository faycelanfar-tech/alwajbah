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
import { Plus, KeyRound, Shield, Power } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { ROLE_LABELS } from "@/lib/branding";

import { toast } from "sonner";

export const Route = createFileRoute("/_app/teachers")({ component: TeachersPage });

function TeachersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", password: "", email: "", role: "teacher" as string });
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
        options: { data: { username: form.username.toLowerCase().trim(), full_name: form.full_name, role: form.role } },
      });
      if (error) throw error;
      if (form.email && data.user) {
        await supabase.from("profiles").update({ email: form.email.trim() }).eq("id", data.user.id);
      }
      // Force-set role (handle_new_user defaults to teacher for non-first user)
      if (data.user && form.role !== "teacher") {
        await supabase.from("user_roles").upsert(
          { user_id: data.user.id, role: form.role as any },
          { onConflict: "user_id,role" }
        );
        // Remove default teacher role if it was assigned
        await supabase.from("user_roles").delete().eq("user_id", data.user.id).eq("role", "teacher");
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false); setForm({ username: "", full_name: "", password: "", email: "", role: "teacher" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الدور");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: isActive } as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "تم تفعيل الحساب" : "تم تعطيل الحساب");
      qc.invalidateQueries({ queryKey: ["users"] });
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
          <h1 className="text-3xl font-bold">المعلمون والحسابات</h1>
          <p className="text-muted-foreground mt-1">إدارة حسابات المستخدمين وأدوارهم</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> إضافة حساب</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة حساب جديد</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>الاسم الكامل *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>اسم المستخدم *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="بالإنجليزية بدون مسافات" /></div>
              <div className="space-y-2">
                <Label>الدور *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>البريد الإلكتروني (اختياري)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" /></div>
              <div className="space-y-2"><Label>كلمة المرور *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} /></div>
              <p className="text-xs text-muted-foreground">⚠️ بعد الحفظ قد يتم تسجيل دخولك بالحساب الجديد. سجّل خروج وادخل مرة أخرى بحسابك.</p>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={!form.username || !form.password || !form.full_name || add.isPending}>إنشاء</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u: { id: string; username: string; full_name: string | null; email: string | null; role: string; is_active?: boolean }) => {
          const active = u.is_active !== false;
          return (
          <Card key={u.id} className={`border-0 shadow-card ${!active ? "opacity-60" : ""}`}>
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
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={u.role === "admin" ? "default" : u.role === "supervisor" ? "outline" : "secondary"}>
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                  {!active && <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">معطّل</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={u.role} onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v })}>
                  <SelectTrigger className="text-xs"><Shield className="w-3 h-3 ml-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setResetUser({ id: u.id, username: u.username })}>
                  <KeyRound className="w-4 h-4 ml-1" /> كلمة المرور
                </Button>
              </div>
              <Button
                variant={active ? "outline" : "default"}
                size="sm"
                className={`w-full ${active ? "text-rose-600 hover:bg-rose-50" : ""}`}
                onClick={() => toggleActive.mutate({ userId: u.id, isActive: !active })}
              >
                <Power className="w-4 h-4 ml-1" /> {active ? "تعطيل الحساب" : "تفعيل الحساب"}
              </Button>
            </CardContent>
          </Card>
          );
        })}
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
