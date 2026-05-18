import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Settings {
  school_name: string;
  subtitle: string | null;
  logo_url: string | null;
  footer_text: string | null;
  primary_color: string | null;
}

const defaults: Settings = {
  school_name: "مدرسة الوجبة الابتدائية",
  subtitle: "نظام إدارة المخالفات السلوكية",
  logo_url: null,
  footer_text: "تطوير: فيصل أحمد عنفار",
  primary_color: "#1d4ed8",
};

const Ctx = createContext<{ settings: Settings; refresh: () => Promise<void> }>({
  settings: defaults, refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  async function refresh() {
    const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setSettings({ ...defaults, ...data });
  }

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ settings, refresh }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
