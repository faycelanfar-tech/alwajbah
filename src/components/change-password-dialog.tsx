import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export function ChangePasswordDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [forced, setForced] = useState(false);
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if ((data as any)?.must_change_password) { setForced(true); setOpen(true); }
      });
  }, [user?.id]);

  async function save() {
    if (pwd.length < 6) return toast.error("كلمة المرور يجب أن تكون 6 خانات على الأقل");
    if (pwd !== confirm) return toast.error("كلمتا المرور غير متطابقتين");
    if (!current) return toast.error("أدخل كلمة المرور الحالية");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd, current_password: current } as any);
    if (error) {
      setSaving(false);
      const m = error.message.toLowerCase();
      if (m.includes("pwned") || m.includes("leaked") || m.includes("weak")) return toast.error("كلمة المرور شائعة جدًا وغير آمنة، اختر كلمة أخرى");
      if (m.includes("current") || m.includes("invalid") || m.includes("incorrect")) return toast.error("كلمة المرور الحالية غير صحيحة");
      if (m.includes("same") || m.includes("different")) return toast.error("يجب أن تختلف كلمة المرور الجديدة عن الحالية");
      return toast.error(error.message);
    }
    if (user) await supabase.from("profiles").update({ must_change_password: false } as any).eq("id", user.id);
    setSaving(false);
    setForced(false);
    setOpen(false);
    setCurrent(""); setPwd(""); setConfirm("");
    toast.success("تم تغيير كلمة المرور بنجاح");
  }

  return (
    <>
      <Button variant="ghost" size="icon" title="تغيير كلمة المرور" onClick={() => setOpen(true)}>
        <KeyRound className="w-5 h-5" />
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!forced) setOpen(v); }}>
        <DialogContent onInteractOutside={(e) => forced && e.preventDefault()} onEscapeKeyDown={(e) => forced && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{forced ? "مرحبًا! غيّر كلمة المرور أولًا" : "تغيير كلمة المرور"}</DialogTitle>
            <DialogDescription>
              {forced
                ? "هذا أول دخول لك. اختر كلمة مرور خاصة بك (6 خانات على الأقل — أرقام أو أحرف أو مزيج)."
                : "6 خانات على الأقل — أرقام أو أحرف أو مزيج منهما."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>كلمة المرور الحالية</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
            <div className="space-y-1"><Label>كلمة المرور الجديدة</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={6} /></div>
            <div className="space-y-1"><Label>تأكيد كلمة المرور الجديدة</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} /></div>
          </div>
          <DialogFooter>
            {!forced && <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>}
            <Button onClick={save} disabled={saving || pwd.length < 6 || !current}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
