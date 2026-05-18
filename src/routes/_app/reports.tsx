import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType } from "docx";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const COLORS = ["#1d4ed8", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function ReportsPage() {
  const { settings } = useSettings();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState<string>("all");

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const { data: violations = [] } = useQuery({
    queryKey: ["violations-report", from, to, classId],
    queryFn: async () => {
      let q = supabase.from("violations")
        .select("*, students(full_name, classes(id, name)), violation_types(name, severity), profiles!violations_created_by_fkey(full_name, username)")
        .gte("violation_date", from).lte("violation_date", to)
        .order("violation_date", { ascending: false });
      const { data } = await q;
      const list = data ?? [];
      return classId === "all" ? list : list.filter((v: any) => v.students?.classes?.id === classId);
    },
  });

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    violations.forEach((v: any) => {
      const k = v.violation_types?.name || "غير محدد";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [violations]);

  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    violations.forEach((v: any) => {
      const k = v.students?.classes?.name || "بدون فصل";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, count]) => ({ name, count }));
  }, [violations]);

  const bySeverity = useMemo(() => {
    const map = new Map<string, number>();
    violations.forEach((v: any) => {
      const k = v.violation_types?.severity || "—";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [violations]);

  function exportExcel() {
    const rows = violations.map((v: any, i: number) => ({
      "م": i + 1,
      "التاريخ": v.violation_date,
      "اسم الطالب": v.students?.full_name || "",
      "الفصل": v.students?.classes?.name || "",
      "نوع المخالفة": v.violation_types?.name || "",
      "الشدة": v.violation_types?.severity || "",
      "الوصف": v.description || "",
      "الإجراء المتخذ": v.action_taken || "",
      "المسجِّل": v.profiles?.full_name || v.profiles?.username || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 30 }, { wch: 22 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المخالفات");
    XLSX.writeFile(wb, `تقرير_المخالفات_${from}_${to}.xlsx`);
  }

  async function exportWord() {
    const headers = ["م", "التاريخ", "الطالب", "الفصل", "نوع المخالفة", "الشدة", "الإجراء"];
    const headRow = new TableRow({
      children: headers.map((h) => new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: "1d4ed8" } as any,
      })),
    });
    const bodyRows = violations.map((v: any, i: number) => new TableRow({
      children: [
        String(i + 1), v.violation_date, v.students?.full_name || "", v.students?.classes?.name || "",
        v.violation_types?.name || "", v.violation_types?.severity || "", v.action_taken || "",
      ].map((c) => new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: c })] })),
    }));

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial" } } } },
      sections: [{
        properties: { page: { textDirection: "rlTb" as any } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: settings.school_name, bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `تقرير المخالفات السلوكية من ${from} إلى ${to}`, bold: true })] }),
          new Paragraph({ text: `إجمالي المخالفات: ${violations.length}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow, ...bodyRows] }),
          new Paragraph({ text: "" }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: settings.footer_text || "", italics: true })] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `تقرير_المخالفات_${from}_${to}.docx`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground mt-1">عرض وتصدير التقارير</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>الفصل</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفصول</SelectItem>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportExcel}><FileDown className="w-4 h-4 ml-1" /> Excel</Button>
          <Button onClick={exportWord}><FileText className="w-4 h-4 ml-1" /> Word</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle>المخالفات حسب الفصل</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass}>
                <XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle>توزيع حسب النوع</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card lg:col-span-2">
          <CardHeader><CardTitle>توزيع حسب درجة الخطورة</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySeverity}>
                <XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {bySeverity.map((s, i) => (
                    <Cell key={i} fill={s.name === "شديدة" ? "#ef4444" : s.name === "متوسطة" ? "#f59e0b" : "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader><CardTitle>التفاصيل ({violations.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">الطالب</th>
                  <th className="text-right p-2">الفصل</th>
                  <th className="text-right p-2">النوع</th>
                  <th className="text-right p-2">الشدة</th>
                  <th className="text-right p-2">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v: any) => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">{v.violation_date}</td>
                    <td className="p-2 font-medium">{v.students?.full_name}</td>
                    <td className="p-2">{v.students?.classes?.name || "—"}</td>
                    <td className="p-2">{v.violation_types?.name || "—"}</td>
                    <td className="p-2">{v.violation_types?.severity || "—"}</td>
                    <td className="p-2">{v.action_taken || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
