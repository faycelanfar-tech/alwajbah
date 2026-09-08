import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEVELOPER_CREDIT, LEVEL_COLORS, ACADEMIC_LEVELS } from "@/lib/branding";

interface Settings {
  school_name: string;
  subtitle: string | null;
  logo_url: string | null;
  footer_text: string | null;
  primary_color: string | null;
}

export interface AcademicTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface GradingLevel {
  id: string;
  label: string;
  color: string;
  min_score: number;
  max_score: number;
  sort_order: number;
}

const defaults: Settings = {
  school_name: "",
  subtitle: "نظام إدارة المخالفات السلوكية",
  logo_url: null,
  footer_text: DEVELOPER_CREDIT,
  primary_color: "#1d4ed8",
};

const defaultLevels: GradingLevel[] = ACADEMIC_LEVELS.map((l, i) => ({
  id: `default-${i}`,
  label: l,
  color: LEVEL_COLORS[l] ?? "#2563eb",
  min_score: 0,
  max_score: 100,
  sort_order: i + 1,
}));

interface Ctx {
  settings: Settings;
  displayName: string;
  terms: AcademicTerm[];
  currentTerm: AcademicTerm | null;
  levels: GradingLevel[];
  levelColor: (label: string) => string;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Ctx>({
  settings: defaults,
  displayName: "نظام إدارة المخالفات",
  terms: [],
  currentTerm: null,
  levels: defaultLevels,
  levelColor: (l) => LEVEL_COLORS[l] ?? "#2563eb",
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [levels, setLevels] = useState<GradingLevel[]>(defaultLevels);

  async function refresh() {
    const [{ data }, { data: t }, { data: g }] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("academic_terms").select("*").order("start_date"),
      supabase.from("grading_levels").select("*").order("sort_order"),
    ]);
    if (data) setSettings({ ...defaults, ...data });
    setTerms((t ?? []) as AcademicTerm[]);
    if (g && g.length) setLevels(g as GradingLevel[]);
  }

  useEffect(() => { refresh(); }, []);

  const displayName = settings.school_name?.trim() || "نظام إدارة المخالفات";
  const currentTerm = terms.find((t) => t.is_current) ?? null;
  const levelColor = (label: string) =>
    levels.find((l) => l.label === label)?.color ?? LEVEL_COLORS[label] ?? "#2563eb";

  return (
    <Ctx.Provider value={{ settings, displayName, terms, currentTerm, levels, levelColor, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
