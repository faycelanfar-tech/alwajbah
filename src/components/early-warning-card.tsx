import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db as supabase } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Siren } from "lucide-react";
import { StudentQuickDialog } from "./student-quick-dialog";

const DAYS = 7;
const THRESHOLD = 3;

export function EarlyWarningCard() {
  const [open, setOpen] = useState<string | null>(null);
  const { data: flagged = [] } = useQuery({
    queryKey: ["early-warning"],
    refetchInterval: 30000,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - (DAYS - 1));
      const { data } = await supabase
        .from("violations")
        .select("student_id, violation_date, students(full_name, classes(name))")
        .gte("violation_date", since.toISOString().slice(0, 10));
      const map = new Map<string, { id: string; name: string; cls: string; count: number; last: string }>();
      for (const v of (data ?? []) as any[]) {
        const e = map.get(v.student_id) ?? { id: v.student_id, name: v.students?.full_name ?? "—", cls: v.students?.classes?.name ?? "", count: 0, last: "" };
        e.count++;
        if (v.violation_date > e.last) e.last = v.violation_date;
        map.set(v.student_id, e);
      }
      return [...map.values()].filter((e) => e.count >= THRESHOLD).sort((a, b) => b.count - a.count);
    },
  });

  return (
    <Card className="border-0 shadow-card border-s-4 border-s-destructive">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Siren className="w-5 h-5 text-destructive" /> التنبيه المبكر
          <Badge variant={flagged.length ? "destructive" : "secondary"}>{flagged.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">طلاب سُجّلت عليهم {THRESHOLD} مخالفات أو أكثر خلال آخر {DAYS} أيام — يُنصح بتدخل المرشد الطلابي</p>
      </CardHeader>
      <CardContent>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">لا يوجد طلاب يحتاجون تدخلاً حالياً 👍</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {flagged.map((s) => (
              <button key={s.id} onClick={() => setOpen(s.id)} className="text-start rounded-lg border bg-destructive/5 hover:bg-destructive/10 p-3 transition-colors">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <Badge variant="destructive">{s.count}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{s.cls} · آخر مخالفة {s.last}</div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
      <StudentQuickDialog studentId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
