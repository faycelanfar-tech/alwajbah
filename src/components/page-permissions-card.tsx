import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_PAGES } from "@/lib/pages";
import { ROLE_LABELS, PROTECTED_USERNAME } from "@/lib/branding";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

const ROLES = Object.keys(ROLE_LABELS);

export function PagePermissionsCard() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["page_permissions"],
    queryFn: async () => (await supabase.from("page_permissions").select("*")).data ?? [],
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-with-roles"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const map = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
      return (profs ?? [])
        .filter((p: any) => p.username !== PROTECTED_USERNAME)
        .map((p: any) => ({ ...p, role: map.get(p.id) as string | undefined }));
    },
  });

  const { data: userPerms = [] } = useQuery({
    queryKey: ["user_page_permissions", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("user_page_permissions").select("*").eq("user_id", userId)).data ?? [],
  });

  const roleValue = (role: string, key: string) => {
    const row = rolePerms.find((p: any) => p.role === role && p.page_key === key);
    if (row) return !!row.visible;
    return APP_PAGES.find((p) => p.key === key)!.roles.includes(role);
  };

  const setRoleValue = useMutation({
    mutationFn: async ({ role, key, visible }: { role: string; key: string; visible: boolean }) => {
      const { error } = await supabase
        .from("page_permissions")
        .upsert({ role: role as any, page_key: key, visible }, { onConflict: "role,page_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page_permissions"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const selectedAccount = accounts.find((a: any) => a.id === userId) as any;

  const userValue = (key: string) => {
    const row = userPerms.find((p: any) => p.page_key === key);
    if (row) return !!row.visible;
    return selectedAccount?.role ? roleValue(selectedAccount.role, key) : true;
  };

  const setUserValue = useMutation({
    mutationFn: async ({ key, visible }: { key: string; visible: boolean }) => {
      const { error } = await supabase
        .from("user_page_permissions")
        .upsert({ user_id: userId, page_key: key, visible }, { onConflict: "user_id,page_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_page_permissions", userId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const resetUser = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_page_permissions").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إعادة الحساب للوضع الافتراضي حسب دوره");
      qc.invalidateQueries({ queryKey: ["user_page_permissions", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>صلاحيات الصفحات</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          تحكّم في الصفحات الظاهرة لكل دور، ويمكنك تخصيص حساب معيّن بشكل مستقل. الصفحة المحجوبة تختفي من القائمة ولا يمكن فتحها.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="border p-2 text-right sticky right-0 bg-secondary">الصفحة</th>
                {ROLES.map((r) => <th key={r} className="border p-2 whitespace-nowrap text-xs">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {APP_PAGES.map((page) => (
                <tr key={page.key}>
                  <td className="border p-2 font-medium whitespace-nowrap sticky right-0 bg-card">{page.label}</td>
                  {ROLES.map((r) => {
                    const locked = page.locked && r === "admin";
                    return (
                      <td key={r} className="border p-2 text-center">
                        <Switch
                          checked={locked ? true : roleValue(r, page.key)}
                          disabled={locked || setRoleValue.isPending}
                          onCheckedChange={(v) => setRoleValue.mutate({ role: r, key: page.key, visible: v })}
                          aria-label={`${page.label} - ${ROLE_LABELS[r]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Label>تخصيص حساب معيّن</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="اختر حساباً" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name || a.username} {a.role ? `— ${ROLE_LABELS[a.role] ?? a.role}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {userId && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {APP_PAGES.map((page) => (
                  <div key={page.key} className="flex items-center justify-between border rounded-lg p-2">
                    <span className="text-sm">{page.label}</span>
                    <Switch
                      checked={userValue(page.key)}
                      disabled={setUserValue.isPending}
                      onCheckedChange={(v) => setUserValue.mutate({ key: page.key, visible: v })}
                      aria-label={page.label}
                    />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => resetUser.mutate()} disabled={resetUser.isPending}>
                <RotateCcw className="w-4 h-4 ml-1" /> إرجاع للوضع الافتراضي
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
