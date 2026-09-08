import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USERNAME_DOMAIN = "alwajbah.local";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: roleRow } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("صلاحية المشرف العام مطلوبة");
}

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already") || m.includes("registered") || m.includes("exists") || m.includes("duplicate"))
    return "اسم المستخدم مستخدم مسبقًا، اختر اسمًا آخر";
  if (m.includes("pwned") || m.includes("leaked") || m.includes("weak") || m.includes("compromised"))
    return "كلمة المرور شائعة جدًا وغير آمنة، اختر كلمة أخرى";
  if (m.includes("password") && (m.includes("least") || m.includes("short") || m.includes("length")))
    return "كلمة المرور يجب أن تكون 6 خانات على الأقل";
  if (m.includes("invalid") && m.includes("email")) return "اسم المستخدم يجب أن يكون بالإنجليزية بدون مسافات أو رموز";
  return msg;
}

type CreateInput = {
  username: string;
  full_name: string;
  password: string;
  email?: string;
  role: string;
  subject_id?: string;
  class_ids?: string[];
};

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateInput) => {
    const username = (input?.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,}$/.test(username)) throw new Error("اسم المستخدم يجب أن يكون بالإنجليزية بدون مسافات");
    if (!input?.full_name?.trim()) throw new Error("الاسم الكامل مطلوب");
    if (!input?.password || input.password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 خانات على الأقل");
    if (!input?.role) throw new Error("الدور مطلوب");
    if (input.role === "teacher" && !input.subject_id) throw new Error("اختر المادة التي يدرّسها المعلم");
    return { ...input, username, full_name: input.full_name.trim(), class_ids: input.class_ids ?? [] };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const a = admin();

    const { data: existing } = await a.from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (existing) throw new Error("اسم المستخدم مستخدم مسبقًا، اختر اسمًا آخر");

    const { data: created, error } = await a.auth.admin.createUser({
      email: `${data.username}@${USERNAME_DOMAIN}`,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, full_name: data.full_name, role: data.role },
    });
    if (error || !created.user) throw new Error(friendlyAuthError(error?.message ?? "تعذر إنشاء الحساب"));
    const uid = created.user.id;

    // Ensure role is exactly what was chosen (trigger defaults to teacher / first admin)
    await a.from("user_roles").delete().eq("user_id", uid);
    const { error: roleErr } = await a.from("user_roles").insert({ user_id: uid, role: data.role as any });
    if (roleErr) throw new Error(roleErr.message);

    await a
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email?.trim() || null,
        must_change_password: true,
      } as any)
      .eq("id", uid);

    if (data.role === "teacher") {
      if (data.subject_id) await a.from("teacher_subjects").insert({ user_id: uid, subject_id: data.subject_id });
      if (data.class_ids.length)
        await a.from("teacher_classes").insert(data.class_ids.map((c) => ({ user_id: uid, class_id: c })));
    }

    return { ok: true, userId: uid };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الحالي");

    const a = admin();
    const uid = data.userId;

    // Remove all records this user created or owns
    const byCreator = ["violations", "positive_behaviors", "academic_reports", "point_transactions", "action_templates"] as const;
    for (const t of byCreator) {
      const { error } = await a.from(t).delete().eq("created_by", uid);
      if (error) throw new Error(`تعذر حذف السجلات (${t}): ${error.message}`);
    }
    const byUser = ["notifications", "teacher_subjects", "teacher_classes", "user_roles"] as const;
    for (const t of byUser) {
      const { error } = await a.from(t).delete().eq("user_id", uid);
      if (error) throw new Error(`تعذر حذف السجلات (${t}): ${error.message}`);
    }
    await a.from("profiles").delete().eq("id", uid);

    const { error } = await a.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
