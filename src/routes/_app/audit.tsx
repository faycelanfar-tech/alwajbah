import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

const actionLabels: Record<string, { text: string; color: string }> = {
  created: { text: "تسجيل مخالفة", color: "bg-blue-100 text-blue-700 border-blue-200" },
  action_set: { text: "تطبيق إجراء", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  action_cleared: { text: "إلغاء إجراء", color: "bg-amber-100 text-amber-700 border-amber-200" },
  updated: { text: "تعديل", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

function AuditPage() {
  const [search, setSearch] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => (await supabase.from("violation_history").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  const filtered = history.filter((h: any) => !search || (h.changed_by_name || "").includes(search) || (h.action || "").includes(search));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><History className="w-7 h-7" /> سجل النشاط</h1>
        <p className="text-muted-foreground mt-1">آخر 500 عملية على المخالفات والإجراءات</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المستخدم أو نوع العملية" className="pr-9" />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="sr-only">القائمة</CardTitle>
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>}
            {filtered.map((h: any) => {
              const meta = actionLabels[h.action] || { text: h.action, color: "" };
              const newData = h.new_data || {};
              const oldData = h.old_data || {};
              return (
                <div key={h.id} className="p-3 rounded-lg border bg-card flex items-start gap-3 flex-wrap">
                  <Badge variant="outline" className={meta.color}>{meta.text}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{h.changed_by_name || "—"}</span>
                      {h.action === "action_set" && newData.action_taken && (
                        <span className="text-muted-foreground"> — طبّق الإجراء: <span className="text-emerald-700 font-medium">{newData.action_taken}</span></span>
                      )}
                      {h.action === "action_cleared" && oldData.action_taken && (
                        <span className="text-muted-foreground"> — ألغى الإجراء: {oldData.action_taken}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(h.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
