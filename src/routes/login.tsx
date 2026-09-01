import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Loader2, School } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نظام إدارة المخالفات" },
      { name: "description", content: "تسجيل دخول المدير والمعلمين والمشرفين إلى نظام إدارة المخالفات المدرسية." },
      { property: "og:title", content: "تسجيل الدخول | نظام إدارة المخالفات" },
      { property: "og:description", content: "الدخول الآمن إلى نظام إدارة المخالفات المدرسية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const { settings, displayName } = useSettings();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    try {
      await signIn(username, password);
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg.includes("Invalid") ? "اسم المستخدم أو كلمة المرور غير صحيحة" : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-white">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="شعار" className="mx-auto w-24 h-24 rounded-full bg-white p-2 object-contain shadow-elegant" />
          ) : (
            <div className="mx-auto w-24 h-24 rounded-full bg-white/10 backdrop-blur flex items-center justify-center shadow-elegant">
              <School className="w-12 h-12" />
            </div>
          )}
          <h1 className="mt-5 text-3xl font-bold">{displayName}</h1>
          <p className="mt-2 text-white/80">{settings.subtitle}</p>
        </div>

        <Card className="shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              تسجيل الدخول
            </CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              الدخول متاح للمشرف العام والمشرف الإداري والمعلم
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="أدخل اسم المستخدم" className="pr-9" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة المرور" className="pr-9" required />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting && <Loader2 className="ml-2 w-4 h-4 animate-spin" />}
                تسجيل الدخول
              </Button>
            </form>
            <div className="text-center mt-4">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-white/70 text-sm">{DEVELOPER_CREDIT}</p>
      </div>
    </div>
  );
}
