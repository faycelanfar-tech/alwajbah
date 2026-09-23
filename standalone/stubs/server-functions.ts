/* eslint-disable @typescript-eslint/no-explicit-any */
// إدارة الحسابات في النسخة المحلية: كل شيء يُحفظ على الجهاز بدون أي خادم.
import { localClient, createLocalAccount, deleteLocalAccount, setLocalPassword } from "./local-engine";

type Call<T> = (args: { data: T }) => Promise<any>;

export const adminResetUserPassword: Call<{ userId: string; newPassword: string }> = async ({ data }) => {
  if (!data?.newPassword || data.newPassword.length < 6)
    throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
  setLocalPassword(data.userId, data.newPassword);
  return { ok: true };
};

export const requestPasswordReset: Call<{ username: string }> = async () => {
  throw new Error("استعادة كلمة المرور بالبريد غير متاحة في النسخة المحلية. اطلب من المشرف العام تعيين كلمة مرور جديدة.");
};

export const adminCreateUser: Call<{
  username: string;
  full_name: string;
  password: string;
  email?: string;
  role: string;
  subject_id?: string;
  class_ids?: string[];
}> = async ({ data }) => {
  const username = (data?.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,}$/.test(username)) throw new Error("اسم المستخدم يجب أن يكون بالإنجليزية بدون مسافات");
  if (!data?.full_name?.trim()) throw new Error("الاسم الكامل مطلوب");
  if (!data?.password || data.password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 خانات على الأقل");
  if (!data?.role) throw new Error("الدور مطلوب");
  if (data.role === "teacher" && !data.subject_id) throw new Error("اختر المادة التي يدرّسها المعلم");

  const { data: existing } = await localClient.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) throw new Error("اسم المستخدم مستخدم مسبقًا، اختر اسمًا آخر");

  const account = createLocalAccount(username, data.password);
  const uid = account.id;

  await localClient.from("profiles").insert({
    id: uid,
    username,
    full_name: data.full_name.trim(),
    email: data.email?.trim() || null,
    is_active: true,
    must_change_password: true,
  });
  await localClient.from("user_roles").insert({ user_id: uid, role: data.role });

  if (data.role === "teacher") {
    if (data.subject_id) await localClient.from("teacher_subjects").insert({ user_id: uid, subject_id: data.subject_id });
    for (const c of data.class_ids ?? []) await localClient.from("teacher_classes").insert({ user_id: uid, class_id: c });
  }
  return { ok: true, userId: uid };
};

export const adminDeleteUser: Call<{ userId: string }> = async ({ data }) => {
  const uid = data?.userId;
  if (!uid) throw new Error("userId مطلوب");
  const { data: target } = await localClient.from("profiles").select("username").eq("id", uid).maybeSingle();
  if (target?.username === "admin") throw new Error("هذا الحساب محمي ولا يمكن حذفه");

  for (const t of ["violations", "positive_behaviors", "academic_reports", "point_transactions", "action_templates"])
    await localClient.from(t).delete().eq("created_by", uid);
  for (const t of ["notifications", "teacher_subjects", "teacher_classes", "user_roles"])
    await localClient.from(t).delete().eq("user_id", uid);
  await localClient.from("students").update({ created_by: null }).eq("created_by", uid);
  await localClient.from("profiles").delete().eq("id", uid);
  deleteLocalAccount(uid);
  return { ok: true };
};
