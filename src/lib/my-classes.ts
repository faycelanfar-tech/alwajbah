import { supabase } from "@/integrations/supabase/client";

/** Classes visible to the user: teachers get only their assigned classes. */
export async function fetchVisibleClasses(role: string | null | undefined, userId: string | undefined, cols = "*") {
  const all = ((await supabase.from("classes").select(cols).order("name")).data ?? []) as any[];
  if (role !== "teacher" || !userId) return all;
  const { data: tc } = await supabase.from("teacher_classes").select("class_id").eq("user_id", userId);
  const ids = new Set((tc ?? []).map((r: any) => r.class_id));
  return all.filter((c) => ids.has(c.id));
}
