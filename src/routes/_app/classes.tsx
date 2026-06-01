import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STAGES = ["المرحلة الأولى", "المرحلة الثانية", "المرحلة الثالثة"];

export const Route = createFileRoute("/_app/classes")({ component: ClassesPage });

function ClassesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [stage, setStage] = useState<string>("المرحلة الأولى");
  const [filterStage, setFilterStage] = useState<string>("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-with-count"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*, students(count)").order("name");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({ name, grade: grade || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); qc.invalidateQueries({ queryKey: ["classes-with-count"] }); qc.invalidateQueries({ queryKey: ["classes"] }); setOpen(false); setName(""); setGrade(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["classes-with-count"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الفصول</h1>
          <p className="text-muted-foreground mt-1">إدارة فصول المدرسة</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> إضافة فصل</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة فصل جديد</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>اسم الفصل *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: 1/أ" /></div>
              <div className="space-y-2"><Label>المرحلة / الصف</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="مثال: الأول الابتدائي" /></div>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={!name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">لا توجد فصول. ابدأ بإضافة فصل جديد.</CardContent>
          </Card>
        )}
        {classes.map((c: any) => (
          <Card key={c.id} className="border-0 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-primary text-primary-foreground">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.grade || "—"}</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الفصل؟")) del.mutate(c.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                عدد الطلاب: <span className="font-semibold text-foreground">{c.students?.[0]?.count ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
