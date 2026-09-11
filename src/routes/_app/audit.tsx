import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Search, LogIn, Lock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS, PROTECTED_USERNAME } from "@/lib/branding";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

const ACTION_LABELS: Record<string, { text: string; color: string }> = {
  created: { text: "إضافة", color: "bg-blue-100 text-blue-700 border-blue-200" },
  updated: { text: "تعديل", color: "bg-amber-100 text-amber-700 border-amber-200" },
  deleted: { text: "حذف", color: "bg-rose-100 text-rose-700 border-rose-200" },
  login: { text: "تسجيل دخول", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const ENTITY_LABELS: Record<string, string> = {
  students: "الطلاب",
  classes: "الفصول",
  violations: "المخالفات",
  positive_behaviors: "السلوك الإيجابي",
  academic_reports: "التقارير الأكاديمية",
  user_roles: "الأدوار والحسابات",
  page_permissions: "صلاحيات الصفحات",
  user_page_permissions: "صلاحيات المستخدمين",
  app_settings: "الإعدادات",
  action_templates: "الإجراءات المحفوظة",
  subjects: "المواد",
  profiles: "الحسابات",
  auth: "الدخول",
};

const PERIODS: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

function AuditPage() {
  const { role, isOwner } = useAuth();
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [period, setPeriod] = useState("30");

  const { data: rows = [] } = useQuery({
    queryKey: ["activity-log", period],
    enabled: role === "admin",
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (PERIODS[period] ?? 30));
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["last-logins"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, last_login_at, is_active"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? [])
        .filter((p: any) => isOwner || p.username !== PROTECTED_USERNAME)
        .map((p: any) => ({ ...p, role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? null }))
        .sort((a: any, b: any) => (b.last_login_at ?? "").localeCompare(a.last_login_at ?? ""));
    },
  });

  if (role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-3">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">هذه الصفحة للمشرف العام فقط</h1>
      </div>
    );
  }

  const ops = rows.filter((r: any) => r.action !== "login");
  const logins = rows.filter((r: any) => r.action === "login");

  const filtered = ops.filter(
    (r: any) =>
      (entity === "all" || r.entity === entity) &&
      (action === "all" || r.action === action) &&
      (!search ||
        (r.actor_name ?? "").includes(search) ||
        (r.summary ?? "").includes(search) ||
        (ENTITY_LABELS[r.entity] ?? "").includes(search)),
  );

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("ar-EG") : "—");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="w-7 h-7" /> تتبع العمليات
        </h1>
        <p className="text-muted-foreground mt-1">آخر العمليات على النظام وآخر تسجيل دخول لكل حساب — للمشرف العام فقط</p>
      </div>

      <Tabs defaultValue="ops">
        <TabsList>
          <TabsTrigger value="ops">آخر العمليات</TabsTrigger>
          <TabsTrigger value="logins">تسجيل الدخول</TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="mt-4">
          <Card className="border-0 shadow-card">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">سجل العمليات ({filtered.length})</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="relative md:col-span-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو القسم" className="pr-9" />
                </div>
                <Select value={entity} onValueChange={setEntity}>
                  <SelectTrigger><SelectValue placeholder="القسم" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأقسام</SelectItem>
                    {Object.entries(ENTITY_LABELS).filter(([k]) => k !== "auth").map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger><SelectValue placeholder="نوع العملية" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="created">إضافة</SelectItem>
                      <SelectItem value="updated">تعديل</SelectItem>
                      <SelectItem value="deleted">حذف</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">آخر 7 أيام</SelectItem>
                      <SelectItem value="30">آخر 30 يوم</SelectItem>
                      <SelectItem value="90">آخر 90 يوم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>}
                {filtered.map((r: any) => {
                  const meta = ACTION_LABELS[r.action] ?? { text: r.action, color: "" };
                  return (
                    <div key={r.id} className="p-3 rounded-lg border bg-card flex items-start gap-3 flex-wrap">
                      <Badge variant="outline" className={meta.color}>{meta.text}</Badge>
                      <Badge variant="secondary">{ENTITY_LABELS[r.entity] ?? r.entity}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm break-words">
                          <span className="font-medium">{r.actor_name || "—"}</span>
                          <span className="text-muted-foreground"> ({ROLE_LABELS[r.actor_role] ?? "—"})</span>
                          {r.summary && <span className="text-muted-foreground"> — {r.summary}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{fmt(r.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins" className="mt-4 space-y-6">
          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle className="text-base">آخر دخول لكل حساب</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accounts.map((a: any) => (
                  <div key={a.id} className="p-3 rounded-lg border bg-card flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.full_name || a.username}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[a.role] ?? "—"} — @{a.username}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{fmt(a.last_login_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><LogIn className="w-4 h-4" /> آخر عمليات الدخول</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logins.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد سجلات دخول بعد</p>}
                {logins.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-lg border bg-card flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className={ACTION_LABELS.login.color}>دخول</Badge>
                    <span className="text-sm font-medium">{r.actor_name || "—"}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABELS[r.actor_role] ?? "—"}</span>
                    <span className="text-xs text-muted-foreground mr-auto">{fmt(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
