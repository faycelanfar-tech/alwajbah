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

export interface BehaviorLevel {
  id: string;
  label: string;
  color: string;
  min_violations: number;
  max_violations: number | null;
  sort_order: number;
}

const defaultBehaviorLevels: BehaviorLevel[] = [
  { id: "b-1", label: "ممتاز", color: "#10b981", min_violations: 0, max_violations: 0, sort_order: 1 },
  { id: "b-2", label: "جيد", color: "#2563eb", min_violations: 1, max_violations: 3, sort_order: 2 },
  { id: "b-3", label: "متوسط", color: "#f59e0b", min_violations: 4, max_violations: 5, sort_order: 3 },
  { id: "b-4", label: "ضعيف", color: "#ef4444", min_violations: 6, max_violations: null, sort_order: 4 },
];

interface Ctx {
  settings: Settings;
  displayName: string;
  terms: AcademicTerm[];
  currentTerm: AcademicTerm | null;
  levels: GradingLevel[];
  behaviorLevels: BehaviorLevel[];
  levelColor: (label: string) => string;
  academicLevelFor: (score: number | null | undefined) => string | null;
  behaviorLevelFor: (count: number) => BehaviorLevel | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Ctx>({
  settings: defaults,
  displayName: "نظام إدارة المخالفات",
  terms: [],
  currentTerm: null,
  levels: defaultLevels,
  behaviorLevels: defaultBehaviorLevels,
  levelColor: (l) => LEVEL_COLORS[l] ?? "#2563eb",
  academicLevelFor: () => null,
  behaviorLevelFor: () => null,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [levels, setLevels] = useState<GradingLevel[]>(defaultLevels);
  const [behaviorLevels, setBehaviorLevels] = useState<BehaviorLevel[]>(defaultBehaviorLevels);

  async function refresh() {
    const [{ data }, { data: t }, { data: g }, { data: b }] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("academic_terms").select("*").order("start_date"),
      supabase.from("grading_levels").select("*").order("sort_order"),
      supabase.from("behavior_levels").select("*").order("sort_order"),
    ]);
    if (data) setSettings({ ...defaults, ...data });
    setTerms((t ?? []) as AcademicTerm[]);
    if (g && g.length) setLevels(g as GradingLevel[]);
    if (b && b.length) setBehaviorLevels(b as BehaviorLevel[]);
  }

  useEffect(() => { refresh(); }, []);

  const displayName = settings.school_name?.trim() || "نظام إدارة المخالفات";
  const currentTerm = terms.find((t) => t.is_current) ?? null;
  const levelColor = (label: string) =>
    levels.find((l) => l.label === label)?.color ??
    behaviorLevels.find((l) => l.label === label)?.color ??
    LEVEL_COLORS[label] ?? "#2563eb";

  const academicLevelFor = (score: number | null | undefined) => {
    if (score === null || score === undefined || Number.isNaN(score)) return null;
    const hit = levels.find((l) => score >= l.min_score && score <= l.max_score);
    return hit?.label ?? null;
  };

  const behaviorLevelFor = (count: number) =>
    behaviorLevels.find(
      (l) => count >= l.min_violations && (l.max_violations === null || count <= l.max_violations),
    ) ?? null;

  return (
    <Ctx.Provider value={{ settings, displayName, terms, currentTerm, levels, behaviorLevels, levelColor, academicLevelFor, behaviorLevelFor, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
