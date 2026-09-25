import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/branding";
import { isSiteOwnerUsername } from "@/lib/branding";

type Role = AppRole;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  profile: { username: string; full_name: string | null } | null;
  /** حساب مسؤول الموقع (admin) — صلاحيات كاملة ومخفي عن الجميع */
  isOwner: boolean;
  /** الدخول تم من النسخة المحفوظة على الجهاز (بدون إنترنت) */
  offlineMode: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const USERNAME_DOMAIN = "alwajbah.local";

const LOCAL_IDENTITY_KEY = "alwajbah.identity";

interface LocalIdentity {
  userId: string;
  username: string;
  full_name: string | null;
  role: Role | null;
  passwordHash?: string;
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

async function hashPassword(username: string, password: string) {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const bytes = new TextEncoder().encode(`${username}::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readIdentity(): LocalIdentity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as LocalIdentity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(next: Partial<LocalIdentity>) {
  if (typeof localStorage === "undefined") return;
  const current = readIdentity() ?? ({} as LocalIdentity);
  localStorage.setItem(LOCAL_IDENTITY_KEY, JSON.stringify({ ...current, ...next }));
}

function offlineUser(id: LocalIdentity): User {
  return {
    id: id.userId,
    email: `${id.username}@${USERNAME_DOMAIN}`,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<AuthCtx["profile"]>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [loading, setLoading] = useState(true);

  function restoreLocal(): boolean {
    const id = readIdentity();
    if (!id?.userId) return false;
    setUser(offlineUser(id));
    setRole(id.role ?? null);
    setProfile({ username: id.username, full_name: id.full_name ?? null });
    setOfflineMode(true);
    return true;
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        setOfflineMode(false);
        setTimeout(() => loadMeta(sess.user.id), 0);
      } else if (!isOnline() && readIdentity()) {
        restoreLocal();
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          setOfflineMode(false);
          loadMeta(data.session.user.id).finally(() => setLoading(false));
        } else {
          if (!isOnline()) restoreLocal();
          setLoading(false);
        }
      })
      .catch(() => {
        restoreLocal();
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, []);

  async function loadMeta(uid: string) {
    try {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
        supabase.from("profiles").select("username, full_name").eq("id", uid).maybeSingle(),
      ]);
      if (r || p) {
        setRole((r?.role as Role) ?? null);
        setProfile(p ?? null);
        saveIdentity({
          userId: uid,
          username: p?.username ?? readIdentity()?.username ?? "",
          full_name: p?.full_name ?? null,
          role: (r?.role as Role) ?? null,
        });
        return;
      }
      throw new Error("no meta");
    } catch {
      const id = readIdentity();
      if (id?.userId === uid) {
        setRole(id.role ?? null);
        setProfile({ username: id.username, full_name: id.full_name ?? null });
      }
    }
  }

  async function signIn(username: string, password: string) {
    const uname = username.trim().toLowerCase();
    const email = `${uname}@${USERNAME_DOMAIN}`;

    // الدخول بدون إنترنت باستخدام آخر حساب دخل على هذا الجهاز
    if (!isOnline()) {
      const id = readIdentity();
      const hash = await hashPassword(uname, password);
      if (id && id.username === uname && id.passwordHash && id.passwordHash === hash) {
        restoreLocal();
        return;
      }
      throw new Error("لا يوجد اتصال بالإنترنت، ويمكن الدخول بدون اتصال فقط بآخر حساب استُخدم على هذا الجهاز.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error((error as { message?: string }).message || "Invalid login credentials");
    if (data.user) {
      const { data: p } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
      if (p && (p as { is_active?: boolean }).is_active === false) {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب معطّل. يرجى مراجعة المشرف العام.");
      }
      saveIdentity({ userId: data.user.id, username: uname, passwordHash: await hashPassword(uname, password) });
      supabase.rpc("record_login").then(() => {}, () => {});
    }
  }

  async function signOut() {
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setOfflineMode(false);
    try {
      await supabase.auth.signOut();
    } catch {
      /* بدون اتصال: يكفي الخروج محلياً */
    }
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        profile,
        isOwner: isSiteOwnerUsername(profile?.username),
        offlineMode,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
