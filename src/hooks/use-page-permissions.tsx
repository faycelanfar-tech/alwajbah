import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { APP_PAGES } from "@/lib/pages";

/**
 * يجمع صلاحيات الصفحات: الافتراضي حسب الدور + استثناء خاص بالحساب.
 */
export function usePagePermissions() {
  const { role, user, loading } = useAuth();

  const { data: rolePerms = [], isLoading: l1 } = useQuery({
    queryKey: ["page_permissions"],
    enabled: !!user,
    queryFn: async () => (await supabase.from("page_permissions").select("*")).data ?? [],
  });

  const { data: userPerms = [], isLoading: l2 } = useQuery({
    queryKey: ["user_page_permissions", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      (await supabase.from("user_page_permissions").select("*").eq("user_id", user!.id)).data ?? [],
  });

  const isVisible = (key: string) => {
    const page = APP_PAGES.find((p) => p.key === key);
    if (!page) return true;
    if (page.locked && role === "admin") return true;

    const override = userPerms.find((p: any) => p.page_key === key);
    if (override) return !!override.visible;

    const rolePerm = rolePerms.find((p: any) => p.page_key === key && p.role === role);
    if (rolePerm) return !!rolePerm.visible;

    return !role || page.roles.includes(role);
  };

  const visiblePages = APP_PAGES.filter((p) => isVisible(p.key));

  return { isVisible, visiblePages, loading: loading || l1 || l2 };
}
