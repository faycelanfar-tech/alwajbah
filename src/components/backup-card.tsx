import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db, syncOutbox } from "@/lib/db";

const TABLES = [
  "classes", "students", "subjects", "violation_types", "violations",
  "action_templates", "positive_behavior_types", "positive_behaviors",
  "participation_cycles", "participation_entries", "academic_reports",
  "academic_terms", "grading_levels", "behavior_levels",
  "teacher_classes", "teacher_subjects", "student_points", "class_weekly_points",
] as const;

export function BackupCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    try {
      const payload: Record<string, unknown[]> = {};
      for (const table of TABLES) {
        const { data } = await (db as never as { from: (t: string) => { select: (c: string) => Promise<{ data: unknown[] | null }> } })
          .from(table)
          .select("*");
        payload[table] = data ?? [];
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: payload }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch {
      toast.error("تعذّر إنشاء النسخة الاحتياطية");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, unknown[]> };
      const data = parsed.data ?? {};
      let total = 0;
      for (const table of TABLES) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const client = db as never as { from: (t: string) => { upsert: (rows: unknown[], o: unknown) => Promise<{ error: unknown }> } };
        const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
        if (!error) total += rows.length;
      }
      await syncOutbox();
      qc.invalidateQueries();
      toast.success(`تم استيراد ${total} سجل`);
    } catch {
      toast.error("الملف غير صالح");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader><CardTitle>النسخ الاحتياطي</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          احفظ كل بيانات النظام في ملف واحد على جهازك، أو استعدها لاحقاً أو على جهاز آخر.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportAll} disabled={busy} variant="outline" className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            تصدير نسخة احتياطية
          </Button>
          <Button asChild disabled={busy} variant="outline" className="gap-2">
            <label className="cursor-pointer">
              <Upload className="w-4 h-4" />
              استيراد نسخة
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
