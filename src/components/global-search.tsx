import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { ROLE_LABELS } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, GraduationCap, UserCog, Users } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { isVisible } = usePagePermissions();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ["search-students"],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name, student_number, classes(name)").order("full_name")).data ?? [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["search-classes"],
    enabled: open,
    queryFn: async () => (await supabase.from("classes").select("id, name, stage").order("name")).data ?? [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["search-users"],
    enabled: open && isVisible("teachers"),
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? null,
      }));
    },
  });

  const term = q.trim();
  const match = (...vals: (string | null | undefined)[]) =>
    !term || vals.some((v) => (v ?? "").toLowerCase().includes(term.toLowerCase()));

  const go = (to: string, params?: any) => {
    setOpen(false);
    setQ("");
    navigate(params ? ({ to, params } as any) : ({ to } as any));
  };

  const studentHits = students.filter((s: any) => match(s.full_name, s.student_number, s.classes?.name)).slice(0, 8);
  const userHits = users.filter((u: any) => match(u.full_name, u.username)).slice(0, 6);
  const classHits = classes.filter((c: any) => match(c.name, c.stage)).slice(0, 6);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="بحث"
        title="بحث (Ctrl + K)"
        onClick={() => setOpen(true)}
      >
        <Search className="w-5 h-5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={q} onValueChange={setQ} placeholder="ابحث عن طالب أو معلم أو فصل..." />
        <CommandList>
          <CommandEmpty>لا توجد نتائج</CommandEmpty>

          {isVisible("students") && studentHits.length > 0 && (
            <CommandGroup heading="الطلاب">
              {studentHits.map((s: any) => (
                <CommandItem key={s.id} value={`student-${s.id}-${s.full_name}`} onSelect={() => go("/students/$id", { id: s.id })}>
                  <GraduationCap className="w-4 h-4 ml-2 text-primary" />
                  <span className="font-medium">{s.full_name}</span>
                  <span className="text-xs text-muted-foreground mr-2">
                    {s.classes?.name || "بدون فصل"}
                    {s.student_number ? ` — ${s.student_number}` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {isVisible("teachers") && userHits.length > 0 && (
            <CommandGroup heading="المعلمون والحسابات">
              {userHits.map((u: any) => (
                <CommandItem key={u.id} value={`user-${u.id}-${u.username}`} onSelect={() => go("/teachers")}>
                  <UserCog className="w-4 h-4 ml-2 text-primary" />
                  <span className="font-medium">{u.full_name || u.username}</span>
                  <span className="text-xs text-muted-foreground mr-2">{ROLE_LABELS[u.role ?? ""] ?? "مستخدم"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {isVisible("classes") && classHits.length > 0 && (
            <CommandGroup heading="الفصول">
              {classHits.map((c: any) => (
                <CommandItem key={c.id} value={`class-${c.id}-${c.name}`} onSelect={() => go("/classes")}>
                  <Users className="w-4 h-4 ml-2 text-primary" />
                  <span className="font-medium">{c.name}</span>
                  {c.stage && <span className="text-xs text-muted-foreground mr-2">{c.stage}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
