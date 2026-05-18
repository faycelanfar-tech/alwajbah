import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { requestPasswordReset } from "@/lib/password.functions";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const { settings } = useSettings();
  const reqReset = useServerFn(requestPasswordReset);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username) return;
    setSubmitting(true);
    try {
      await reqReset({
        data: {
          username,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      setSent(true);
      toast.success("إذا كان الحساب يحتوي على بريد، تم إرسال رابط الاستعادة");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 text-white">
          <h1 className="text-2xl font-bold">{settings.school_name}</h1>
        </div>
        <Card className="shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="text-center text-xl">نسيت كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  إذا كان لحسابك بريد إلكتروني مسجّل، فقد تم إرسال رابط لإعادة تعيين كلمة المرور.
                  راجع صندوق الوارد (وقد يصل إلى مجلد البريد المهمل).
                </p>
                <p className="text-xs text-muted-foreground">
                  إذا لم تستلم بريداً، تواصل مع مدير النظام لإعادة تعيين كلمة المرور.
                </p>
                <Link to="/login" className="inline-flex items-center text-primary hover:underline">
                  العودة لتسجيل الدخول <ArrowRight className="mr-1 w-4 h-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  أدخل اسم المستخدم، وسنرسل رابط استعادة لبريدك المسجّل إن وُجد.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="u">اسم المستخدم</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} className="pr-9" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="ml-2 w-4 h-4 animate-spin" />}
                  إرسال رابط الاستعادة
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-muted-foreground hover:underline">
                    العودة لتسجيل الدخول
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
