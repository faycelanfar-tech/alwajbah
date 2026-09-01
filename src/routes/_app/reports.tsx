import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileText, Printer, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType } from "docx";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const COLORS = ["#1d4ed8", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function ReportsPage() {
  const { settings } = useSettings();
  const { role, user, profile } = useAuth();
  const isTeacher = role === "teacher";
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState<string>("all");
  const [grade, setGrade] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");
  const [studentId, setStudentId] = useState<string>("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [typeId, setTypeId] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState<boolean>(false);
  const onlyMine = isTeacher || mineOnly;


  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });
  const { data: vtypes = [] } = useQuery({
    queryKey: ["violation_types"],
    queryFn: async () => (await supabase.from("violation_types").select("*").order("name")).data ?? [],
  });
  const { data: allStudents = [] } = useQuery({
    queryKey: ["students-all"],
    queryFn: async () => (await supabase.from("students").select("id, full_name, class_id").order("full_name")).data ?? [],
  });

  const stages = useMemo(
    () => Array.from(new Set(classes.map((c: any) => c.stage).filter(Boolean))).sort() as string[],
    [classes],
  );
  // الصفوف الدراسية ضمن المرحلة المختارة
  const grades = useMemo(
    () =>
      Array.from(
        new Set(
          classes
            .filter((c: any) => stage === "all" || c.stage === stage)
            .map((c: any) => c.grade)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [classes, stage],
  );
  // الفصول ضمن المرحلة + الصف المختار
  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (c: any) => (stage === "all" || c.stage === stage) && (grade === "all" || c.grade === grade),
      ),
    [classes, stage, grade],
  );
  // الطلاب ضمن الفصول المتاحة
  const filteredStudents = useMemo(() => {
    const ids = new Set(filteredClasses.map((c: any) => c.id));
    const list = allStudents.filter((s: any) =>
      classId !== "all" ? s.class_id === classId : ids.has(s.class_id),
    );
    const q = studentSearch.trim();
    return q ? list.filter((s: any) => (s.full_name || "").includes(q)) : list;
  }, [allStudents, filteredClasses, classId, studentSearch]);

  // إعادة الضبط عند تغيّر المستويات الأعلى
  useEffect(() => {
    if (grade !== "all" && !grades.includes(grade)) setGrade("all");
  }, [grades, grade]);
  useEffect(() => {
    if (classId !== "all" && !filteredClasses.some((c: any) => c.id === classId)) setClassId("all");
  }, [filteredClasses, classId]);
  useEffect(() => {
    if (studentId !== "all" && !filteredStudents.some((s: any) => s.id === studentId)) setStudentId("all");
  }, [filteredStudents, studentId]);

  const selectedStudent = useMemo(
    () => allStudents.find((s: any) => s.id === studentId) as any,
    [allStudents, studentId],
  );
  const selectedStudentClass = useMemo(
    () => classes.find((c: any) => c.id === selectedStudent?.class_id) as any,
    [classes, selectedStudent],
  );

  const { data: violations = [] } = useQuery({
    queryKey: ["violations-report", from, to, stage, classId, grade, studentId, severity, typeId],
    queryFn: async () => {
      let q = supabase.from("violations")
        .select("*, students(id, full_name, class_id, classes(id, name, grade, stage)), violation_types(id, name, severity)")
        .gte("violation_date", from).lte("violation_date", to)
        .order("violation_date", { ascending: false });
      if (typeId !== "all") q = q.eq("type_id", typeId);
      if (studentId !== "all") q = q.eq("student_id", studentId);
      const { data } = await q;
      let list = data ?? [];
      const ids = Array.from(new Set(list.map((v: any) => v.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        list.forEach((v: any) => { v.profiles = map.get(v.created_by) ?? null; });
      }
      if (classId !== "all") list = list.filter((v: any) => v.students?.classes?.id === classId);
      if (grade !== "all") list = list.filter((v: any) => v.students?.classes?.grade === grade);
      if (stage !== "all") list = list.filter((v: any) => v.students?.classes?.stage === stage);
      if (severity !== "all") list = list.filter((v: any) => v.violation_types?.severity === severity);
      return list;
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

  const byStudent = useMemo(() => {
    const map = new Map<string, { name: string; klass: string; count: number }>();
    violations.forEach((v: any) => {
      const id = v.student_id;
      if (!id) return;
      const cur = map.get(id) || { name: v.students?.full_name || "—", klass: v.students?.classes?.name || "—", count: 0 };
      cur.count++;
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [violations]);

  const classRanking = useMemo(() => [...byClass].sort((a, b) => b.count - a.count), [byClass]);
  const typeRanking = useMemo(() => [...byType].sort((a, b) => b.value - a.value), [byType]);
  const actionsDone = useMemo(() => violations.filter((v: any) => v.action_taken).length, [violations]);
  const actionsPending = violations.length - actionsDone;

  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedStudent) parts.push(`الطالب: ${selectedStudent.full_name}`);
    if (selectedStudent && selectedStudentClass) parts.push(`الفصل: ${selectedStudentClass.name}`);
    else if (classId !== "all") parts.push(`الفصل: ${classes.find((c: any) => c.id === classId)?.name || ""}`);
    if (grade !== "all") parts.push(`المستوى: ${grade}`);
    if (stage !== "all") parts.push(stage);
    if (severity !== "all") parts.push(`الدرجة: ${severity}`);
    if (typeId !== "all") parts.push(`النوع: ${vtypes.find((t: any) => t.id === typeId)?.name || ""}`);
    return parts.join(" — ");
  }, [selectedStudent, selectedStudentClass, classId, grade, stage, severity, typeId, classes, vtypes]);

  const fileSuffix = useMemo(() => {
    const n = selectedStudent?.full_name || (classId !== "all" ? classes.find((c: any) => c.id === classId)?.name : "") || (grade !== "all" ? grade : "");
    return `${n ? String(n).replace(/\s+/g, "_") + "_" : ""}${from}_${to}`;
  }, [selectedStudent, classId, grade, classes, from, to]);

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
    XLSX.writeFile(wb, `تقرير_المخالفات_${fileSuffix}.xlsx`);
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
          new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: settings.school_name?.trim() || "نظام إدارة المخالفات", bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `تقرير المخالفات السلوكية من ${from} إلى ${to}`, bold: true })] }),
          new Paragraph({ text: `إجمالي المخالفات: ${violations.length}`, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow, ...bodyRows] }),
          new Paragraph({ text: "" }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `تقرير_المخالفات_${fileSuffix}.docx`);
  }

  function buildReportHtml(autoPrint: boolean) {
    const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

    const school = settings.school_name?.trim() || "نظام إدارة المخالفات";
    const sub = settings.subtitle || "";

    // Capture rendered charts as inline SVG for printing
    const chartNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-print-chart]"));
    const chartsHtml = chartNodes.map((node) => {
      const title = node.getAttribute("data-print-chart") || "";
      const svg = node.querySelector("svg.recharts-surface") as SVGSVGElement | null;
      if (!svg) return "";
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const w = svg.getBoundingClientRect().width || 600;
      const h = svg.getBoundingClientRect().height || 280;
      if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
      clone.style.width = "100%";
      clone.style.height = "auto";
      return `<div class="chart"><h3>${esc(title)}</h3>${clone.outerHTML}</div>`;
    }).join("");

    const rows = violations.map((v: any, i: number) => `
      <tr>
        <td>${i + 1}</td><td>${v.violation_date}</td>
        <td>${esc(v.students?.full_name || "")}</td>
        <td>${esc(v.students?.classes?.name || "")}</td>
        <td>${esc(v.violation_types?.name || "")}</td>
        <td>${esc(v.violation_types?.severity || "")}</td>
        <td>${esc(v.action_taken || "—")}</td>
        <td>${esc(v.profiles?.full_name || v.profiles?.username || "")}</td>
      </tr>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير المخالفات</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; }
        .header { text-align: center; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { margin: 0; color: #1d4ed8; font-size: 22px; }
        .header p { margin: 4px 0; color: #555; font-size: 13px; }
        .stats { display: flex; gap: 8px; margin: 10px 0 16px; }
        .stat { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; text-align: center; }
        .stat b { display: block; font-size: 18px; color: #1d4ed8; }
        .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
        .chart { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; page-break-inside: avoid; }
        .chart h3 { margin: 0 0 6px; font-size: 13px; color: #1d4ed8; text-align: center; }
        .chart svg { width: 100% !important; height: auto !important; max-height: 240px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        th, td { border: 1px solid #d1d5db; padding: 6px; text-align: right; }
        th { background: #1d4ed8; color: #fff; }
        tr:nth-child(even) td { background: #f9fafb; }
        .footer { margin-top: 18px; text-align: center; font-size: 11px; color: #777; border-top: 1px solid #e5e7eb; padding-top: 8px; }
        h2 { color: #1d4ed8; font-size: 15px; margin: 16px 0 8px; }
      </style></head><body>
      <div class="header">
        ${settings.logo_url ? `<img src="${esc(settings.logo_url)}" alt="شعار المدرسة" style="height:64px;object-fit:contain;margin-bottom:6px" />` : ""}
        <h1>${esc(school)}</h1>
        ${sub ? `<p>${esc(sub)}</p>` : ""}
        <p><b>${selectedStudent ? "التقرير السلوكي للطالب" : "تقرير المخالفات السلوكية"}</b> — من ${from} إلى ${to}</p>
        ${selectedStudent ? `<p><b>الطالب:</b> ${esc(selectedStudent.full_name)} ${selectedStudentClass ? `— <b>الفصل:</b> ${esc(selectedStudentClass.name)}` : ""}</p>` : ""}
        ${scopeLabel && !selectedStudent ? `<p>${esc(scopeLabel)}</p>` : ""}
      </div>
      <div class="stats">
        <div class="stat"><b>${violations.length}</b>إجمالي المخالفات</div>
        <div class="stat"><b>${actionsDone}</b>تم اتخاذ إجراء</div>
        <div class="stat"><b>${actionsPending}</b>بانتظار إجراء</div>
        <div class="stat"><b>${byStudent.length}</b>عدد الطلاب</div>
      </div>
      ${chartsHtml ? `<h2>الرسوم البيانية</h2><div class="charts">${chartsHtml}</div>` : ""}
      <h2>تفاصيل المخالفات</h2>
      <table>
        <thead><tr>
          <th>م</th><th>التاريخ</th><th>الطالب</th><th>الفصل</th>
          <th>نوع المخالفة</th><th>الشدة</th><th>الإجراء</th><th>المسجِّل</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="8" style="text-align:center;padding:20px">لا توجد بيانات</td></tr>`}</tbody>
      </table>
      <div class="footer">${new Date().toLocaleDateString("ar-EG")}</div>
      ${autoPrint ? `<script>window.onload = () => { setTimeout(() => window.print(), 300); };<\/script>` : ""}
      </body></html>`;
    return html;
  }

  function exportPDF() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = buildReportHtml(true);
    w.document.open(); w.document.write(html); w.document.close();
  }

  function downloadReport() {
    const blob = new Blob([buildReportHtml(false)], { type: "text/html;charset=utf-8" });
    saveAs(blob, `تقرير_المخالفات_${fileSuffix}.html`);
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground mt-1">عرض وتصدير التقارير — {settings.school_name}</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>المرحلة</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المراحل</SelectItem>
                  {stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستوى / الصف</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستويات</SelectItem>
                  {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفصل</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفصول</SelectItem>
                  {filteredClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الطالب</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="p-2 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="ابحث باسم الطالب..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="all">كل الطلاب</SelectItem>
                  {filteredStudents.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="whitespace-normal break-words">
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>درجة المخالفة</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الدرجات</SelectItem>
                  <SelectItem value="الأولى">الأولى</SelectItem>
                  <SelectItem value="الثانية">الثانية</SelectItem>
                  <SelectItem value="الثالثة">الثالثة</SelectItem>
                  <SelectItem value="الرابعة">الرابعة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نوع المخالفة</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {vtypes.map((t: any) => <SelectItem key={t.id} value={t.id} className="whitespace-normal break-words">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {scopeLabel && (
            <p className="text-sm text-muted-foreground pt-1">التصفية الحالية: {scopeLabel}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" onClick={exportExcel}><FileDown className="w-4 h-4 ml-1" /> Excel</Button>
            <Button variant="outline" onClick={exportWord}><FileText className="w-4 h-4 ml-1" /> Word</Button>
            <Button variant="outline" onClick={downloadReport}><Download className="w-4 h-4 ml-1" /> تحميل نسخة</Button>
            <Button onClick={exportPDF}><Printer className="w-4 h-4 ml-1" /> طباعة / PDF</Button>
          </div>

        </CardContent>
      </Card>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-card" data-print-chart="المخالفات حسب الفصل">
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

        <Card className="border-0 shadow-card" data-print-chart="توزيع حسب نوع المخالفة">
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

        <Card className="border-0 shadow-card lg:col-span-2" data-print-chart="توزيع حسب درجة الخطورة">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <MetricCard label="إجمالي المخالفات" value={violations.length} tone="primary" />
        <MetricCard label="تم اتخاذ إجراء" value={actionsDone} tone="emerald" />
        <MetricCard label="بانتظار إجراء" value={actionsPending} tone="amber" />
        <MetricCard label="عدد الطلاب المخالفين" value={byStudent.length} tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankCard
          title="🏆 الأفضل سلوكاً (الأقل مخالفات)"
          rows={[...byStudent].reverse().slice(0, 10).map((s, i) => ({ rank: i + 1, primary: s.name, secondary: s.klass, value: s.count, suffix: "مخالفة" }))}
          empty="لا توجد بيانات"
          good
        />
        <RankCard
          title="⚠️ الأكثر مخالفات (الطلاب)"
          rows={byStudent.slice(0, 10).map((s, i) => ({ rank: i + 1, primary: s.name, secondary: s.klass, value: s.count, suffix: "مخالفة" }))}
          empty="لا توجد بيانات"
        />
        <RankCard
          title="🥇 الصف الأفضل (الأقل مخالفات)"
          rows={[...classRanking].reverse().slice(0, 10).map((c, i) => ({ rank: i + 1, primary: c.name, value: c.count, suffix: "مخالفة" }))}
          empty="لا توجد بيانات"
          good
        />
        <RankCard
          title="📉 الصف الأكثر مخالفات"
          rows={classRanking.slice(0, 10).map((c, i) => ({ rank: i + 1, primary: c.name, value: c.count, suffix: "مخالفة" }))}
          empty="لا توجد بيانات"
        />
        <RankCard
          title="🔁 المخالفات الأكثر ارتكاباً"
          rows={typeRanking.slice(0, 10).map((t, i) => ({ rank: i + 1, primary: t.name, value: t.value, suffix: "مرة" }))}
          empty="لا توجد بيانات"
          className="lg:col-span-2"
        />
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

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "primary" | "emerald" | "amber" | "rose" }) {
  const map = {
    primary: "bg-primary/5 border-primary/20 text-primary",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  };
  return (
    <Card className={`border ${map[tone]}`}>
      <CardContent className="p-4">
        <p className="text-sm opacity-80">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows, empty, good, className }: { title: string; rows: { rank: number; primary: string; secondary?: string; value: number; suffix: string }[]; empty: string; good?: boolean; className?: string }) {
  return (
    <Card className={`border-0 shadow-card ${className || ""}`}>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{empty}</p>}
        <div className="space-y-1">
          {rows.map((r) => {
            const top = r.rank <= 3;
            const badgeClass = top
              ? (good ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
              : "bg-secondary text-muted-foreground";
            return (
              <div key={r.rank} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${badgeClass}`}>{r.rank}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.primary}</p>
                    {r.secondary && <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>}
                  </div>
                </div>
                <span className="text-sm font-bold whitespace-nowrap">{r.value} {r.suffix}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
