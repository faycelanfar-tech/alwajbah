import { createFileRoute, Link } from "@tanstack/react-router";
import masarLogoUrl from "@/assets/masar-logo.png";
const masarLogo = { url: masarLogoUrl };
import { DEVELOPER_CREDIT } from "@/lib/branding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مسار MASAR | نظام المتابعة الأكاديمية والسلوكية" },
      { name: "description", content: "مسار: نظام المتابعة الأكاديمية والسلوكية للطلاب والمعلمين والمشرفين." },
      { property: "og:title", content: "مسار MASAR | نظام المتابعة الأكاديمية والسلوكية" },
      { property: "og:description", content: "مسار: نظام المتابعة الأكاديمية والسلوكية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 text-white">
      <div className="text-center max-w-lg">
        <img src={masarLogo.url} alt="شعار مسار" className="mx-auto w-48 h-auto rounded-3xl bg-white p-4 object-contain shadow-elegant" />
        <h1 className="mt-8 text-5xl font-bold tracking-[0.3em]">مــســار</h1>
        <p className="mt-3 text-lg text-white/85">نظام المتابعة الأكاديمية والسلوكية</p>
        <p className="mt-4 text-white/70">مرحبًا بك في مسار، منصتك لمتابعة الطلاب أكاديميًا وسلوكيًا بسهولة ووضوح.</p>
        <Link to="/login" className="mt-8 inline-flex items-center justify-center rounded-xl bg-white text-primary font-bold px-10 py-3 text-lg shadow-elegant hover:opacity-90 transition">
          دخول النظام
        </Link>
        <p className="mt-10 text-sm text-white/60">{DEVELOPER_CREDIT}</p>
      </div>
    </div>
  );
}
