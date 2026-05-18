import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Admin: directly set a user's password (requires admin role)
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; newPassword: string }) => {
    if (!input?.userId) throw new Error("userId مطلوب");
    if (!input?.newPassword || input.newPassword.length < 6)
      throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase: userClient, userId } = context;
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("صلاحية المدير مطلوبة");

    const a = admin();
    const { error } = await a.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: request a reset link by username (looks up real email from profiles)
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; redirectTo: string }) => {
    if (!input?.username) throw new Error("اسم المستخدم مطلوب");
    if (!input?.redirectTo) throw new Error("redirectTo مطلوب");
    return input;
  })
  .handler(async ({ data }) => {
    const a = admin();
    const uname = data.username.trim().toLowerCase();
    const { data: profile } = await a
      .from("profiles")
      .select("id, email")
      .eq("username", uname)
      .maybeSingle();

    // Always respond OK to avoid username enumeration
    if (!profile?.email) return { ok: true };

    const { error } = await a.auth.resetPasswordForEmail(profile.email, {
      redirectTo: data.redirectTo,
    });
    if (error) console.error("resetPasswordForEmail:", error.message);
    return { ok: true };
  });
