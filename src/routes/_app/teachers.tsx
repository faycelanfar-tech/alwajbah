import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/teachers")({ component: TeachersPage });

function TeachersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", password: "" });

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
      const { error } = await supabase.auth.signUp({
        email, password: form.password,
        options: { data: { username: form.username.toLowerCase().trim(), full_name: form.full_name } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب المعلم");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false); setForm({ username: "", full_name: "", password: "" });
    },
    onError: (e: any) => toast.error(e.message),
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
              <div className="space-y-2"><Label>كلمة المرور *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} /></div>
              <p className="text-xs text-muted-foreground">⚠️ بعد الحفظ قد يتم تسجيل دخولك بحساب المعلم الجديد. سجّل خروج وادخل مرة أخرى بحسابك.</p>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={!form.username || !form.password || !form.full_name}>إنشاء</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u: any) => (
          <Card key={u.id} className="border-0 shadow-card">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {(u.full_name || u.username).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{u.full_name || u.username}</p>
                <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
              </div>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                {u.role === "admin" ? "مدير" : "معلم"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
