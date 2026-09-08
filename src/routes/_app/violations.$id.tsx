import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Printer } from "lucide-react";
import { ROLE_LABELS, SEVERITY_COLORS } from "@/lib/branding";

export const Route = createFileRoute("/_app/violations/$id")({
  component: ViolationDetail,
  head: () => ({
    meta: [
      { title: "تفاصيل المخالفة | نظام المتابعة المدرسية" },
      { name: "description", content: "عرض تفاصيل المخالفة السلوكية: التاريخ والنوع والدرجة وملاحظات المعلم والإجراء المتخذ وسجل التعديلات." },
      { property: "og:title", content: "تفاصيل المخالفة" },
      { property: "og:description", content: "تفاصيل المخالفة والإجراء المتخذ وسجل التعديلات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACTION_LABELS: Record<string, string> = {
  created: "تسجيل المخالفة",
  updated: "تعديل",
  action_set: "تحديد الإجراء",
  action_cleared: "إلغاء الإجراء",
  deleted: "حذف",
};

function ViolationDetail() {
  const { id } = Route.useParams();
  const { displayName, settings } = useSettings();

  const { data: v, isLoading } = useQuery({
    queryKey: ["violation-detail", id],
    queryFn: async () =>
      (await supabase
        .from("violations")
        .select("*, violation_types(name, severity), students(id, full_name, classes(name, stage))")
        .eq("id", id)
        .maybeSingle()).data,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["violation-history-page", id],
    queryFn: async () =>
      (await supabase
        .from("violation_history")
        .select("*")
        .eq("violation_id", id)
        .order("created_at", { ascending: true })).data ?? [],
  });

  const changerIds = Array.from(new Set(history.map((h: any) => h.changed_by).filter(Boolean)));
  const { data: roles = [] } = useQuery({
    queryKey: ["history-roles", id, changerIds.length],
    enabled: changerIds.length > 0,
    queryFn: async () =>
      (await supabase.from("user_roles").select("user_id, role").in("user_id", changerIds as string[])).data ?? [],
  });
  const roleOf = (uid: string | null) => {
    const r = roles.find((x: any) => x.user_id === uid)?.role;
    return r ? ROLE_LABELS[r] ?? r : "";
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;
  if (!v) return <div className="text-center py-12 text-muted-foreground">المخالفة غير موجودة</div>;

  const severity = (v as any).violation_types?.severity;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/violations"><Button variant="ghost" size="icon"><ArrowRight className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold">تفاصيل المخالفة</h1>
            <p className="text-muted-foreground mt-1">{(v as any).students?.full_name} — {(v as any).students?.classes?.name || "بدون فصل"}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" /> طباعة</Button>
      </div>

      <div className="hidden print:block text-center border-b pb-3">
        {settings.logo_url && <img src={settings.logo_url} alt="شعار المدرسة" className="w-16 h-16 mx-auto object-contain mb-2" />}
        <h2 className="text-xl font-bold">{displayName}</h2>
        <p className="text-sm">بطاقة مخالفة سلوكية</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>بيانات المخالفة</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="الطالب">
            <Link to="/students/$id" params={{ id: (v as any).students?.id }} className="text-primary hover:underline">
              {(v as any).students?.full_name}
            </Link>
          </Field>
          <Field label="الصف">{(v as any).students?.classes?.name || "—"}</Field>
          <Field label="التاريخ">{v.violation_date}</Field>
          <Field label="الحصة">{v.period ? `الحصة ${v.period}` : "—"}</Field>
          <Field label="نوع المخالفة">{(v as any).violation_types?.name || "—"}</Field>
          <Field label="الدرجة">
            {severity ? (
              <Badge variant="outline" style={{ borderColor: SEVERITY_COLORS[severity], color: SEVERITY_COLORS[severity] }}>
                الدرجة {severity}
              </Badge>
            ) : "—"}
          </Field>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground mb-1">ملاحظات المعلم</p>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{v.description || "—"}</p>
          </div>
          {v.attachment_url && (
            <div className="sm:col-span-2 print:hidden">
              <a href={v.attachment_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">عرض المرفق</a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>الإجراء المتخذ</CardTitle></CardHeader>
        <CardContent>
          {v.action_taken ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {v.action_taken}
            </div>
          ) : (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">بانتظار إجراء</Badge>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>سجل التعديلات ({history.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل</p>}
          {history.map((h: any) => (
            <div key={h.id} className="border-r-2 border-primary/40 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("ar-EG")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {h.changed_by_name || "غير معروف"}
                {roleOf(h.changed_by) && ` — ${roleOf(h.changed_by)}`}
              </p>
              {h.action === "action_set" && h.new_data?.action_taken && (
                <p className="text-sm mt-1 break-words">الإجراء: {h.new_data.action_taken}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1">{label}</p>
      <div className="font-medium break-words">{children}</div>
    </div>
  );
}
