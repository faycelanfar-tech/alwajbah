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

const emptyForm = { username: "", full_name: "", password: "", email: "", role: "teacher" as string, subject_id: "", class_ids: [] as string[] };

function TeachersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resetUser, setResetUser] = useState<{ id: string; username: string } | null>(null);
  const [assignUser, setAssignUser] = useState<{ id: string; name: string } | null>(null);
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

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("sort_order")).data ?? [],
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });
  const { data: tSubjects = [] } = useQuery({
    queryKey: ["teacher_subjects"],
    queryFn: async () => (await supabase.from("teacher_subjects").select("*")).data ?? [],
  });
  const { data: tClasses = [] } = useQuery({
    queryKey: ["teacher_classes"],
    queryFn: async () => (await supabase.from("teacher_classes").select("*")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (form.role === "teacher" && !form.subject_id) throw new Error("اختر المادة التي يدرّسها المعلم");
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
      if (data.user && form.role === "teacher") {
        await supabase.from("teacher_subjects").insert({ user_id: data.user.id, subject_id: form.subject_id });
        if (form.class_ids.length) {
          await supabase.from("teacher_classes").insert(form.class_ids.map((c) => ({ user_id: data.user!.id, class_id: c })));
        }
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["teacher_subjects"] });
      qc.invalidateQueries({ queryKey: ["teacher_classes"] });
      setOpen(false); setForm(emptyForm);
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
              {form.role === "teacher" && (
                <>
                  <div className="space-y-2">
                    <Label>المادة التي يدرّسها *</Label>
                    <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {subjects.length === 0 && <p className="text-xs text-amber-600">أضف المواد أولاً من صفحة الإعدادات.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>الصفوف التي يدرّسها</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 grid grid-cols-2 gap-1">
                      {classes.map((c: any) => {
                        const checked = form.class_ids.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setForm({ ...form, class_ids: checked ? form.class_ids.filter((x) => x !== c.id) : [...form.class_ids, c.id] })}
                            />
                            {c.name}
                          </label>
                        );
                      })}
                      {classes.length === 0 && <p className="text-xs text-muted-foreground">لا توجد فصول</p>}
                    </div>
                  </div>
                </>
              )}
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
              {u.role === "teacher" && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    المادة: {subjects.filter((s: any) => tSubjects.some((t: any) => t.user_id === u.id && t.subject_id === s.id)).map((s: any) => s.name).join("، ") || "—"}
                  </p>
                  <p>
                    الصفوف: {classes.filter((c: any) => tClasses.some((t: any) => t.user_id === u.id && t.class_id === c.id)).map((c: any) => c.name).join("، ") || "—"}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setAssignUser({ id: u.id, name: u.full_name || u.username })}>
                    تعديل المواد والصفوف
                  </Button>
                </div>
              )}
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

      {assignUser && (
        <AssignDialog
          user={assignUser}
          onClose={() => setAssignUser(null)}
          subjects={subjects}
          classes={classes}
          currentSubjects={tSubjects.filter((t: any) => t.user_id === assignUser.id).map((t: any) => t.subject_id)}
          currentClasses={tClasses.filter((t: any) => t.user_id === assignUser.id).map((t: any) => t.class_id)}
        />
      )}
    </div>
  );
}

function AssignDialog({ user, onClose, subjects, classes, currentSubjects, currentClasses }: {
  user: { id: string; name: string };
  onClose: () => void;
  subjects: any[];
  classes: any[];
  currentSubjects: string[];
  currentClasses: string[];
}) {
  const qc = useQueryClient();
  const [subjectIds, setSubjectIds] = useState<string[]>(currentSubjects);
  const [classIds, setClassIds] = useState<string[]>(currentClasses);

  const save = useMutation({
    mutationFn: async () => {
      await supabase.from("teacher_subjects").delete().eq("user_id", user.id);
      await supabase.from("teacher_classes").delete().eq("user_id", user.id);
      if (subjectIds.length) {
        const { error } = await supabase.from("teacher_subjects").insert(subjectIds.map((s) => ({ user_id: user.id, subject_id: s })));
        if (error) throw error;
      }
      if (classIds.length) {
        const { error } = await supabase.from("teacher_classes").insert(classIds.map((c) => ({ user_id: user.id, class_id: c })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ المواد والصفوف");
      qc.invalidateQueries({ queryKey: ["teacher_subjects"] });
      qc.invalidateQueries({ queryKey: ["teacher_classes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>المواد والصفوف — {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>المواد</Label>
            <div className="max-h-36 overflow-y-auto border rounded-lg p-2 grid grid-cols-2 gap-1">
              {subjects.map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={subjectIds.includes(s.id)} onChange={() => toggle(subjectIds, setSubjectIds, s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>الصفوف</Label>
            <div className="max-h-36 overflow-y-auto border rounded-lg p-2 grid grid-cols-2 gap-1">
              {classes.map((c: any) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => toggle(classIds, setClassIds, c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
