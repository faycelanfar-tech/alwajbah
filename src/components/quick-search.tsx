import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function QuickSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: students = [] } = useQuery({
    queryKey: ["quick-search-students"],
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name, student_number, classes(name)").order("full_name")).data ?? [],
  });

  const term = q.trim();
  const results = term
    ? students
        .filter(
          (s: any) =>
            s.full_name?.includes(term) ||
            (s.student_number || "").includes(term),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="بحث سريع عن طالب (الاسم أو الرقم)"
        className="pr-9 h-10"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {results.map((s: any) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => {
                setQ("");
                setOpen(false);
                navigate({ to: "/students/$id", params: { id: s.id } });
              }}
              className="w-full text-right px-3 py-2 text-sm hover:bg-secondary flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.full_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {s.classes?.name || s.student_number || ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
