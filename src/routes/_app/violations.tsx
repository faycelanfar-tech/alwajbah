import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Search,
  Settings,
  ClipboardEdit,
  History,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/violations")({
  component: ViolationsPage,
});

const DEGREES = ["الأولى", "الثانية", "الثالثة", "الرابعة"] as const;

const severityColor: Record<string, string> = {
  "الأولى": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "الثانية": "bg-amber-100 text-amber-700 border-amber-200",
  "الثالثة": "bg-orange-100 text-orange-700 border-orange-200",
  "الرابعة": "bg-rose-100 text-rose-700 border-rose-200",
};

function ViolationsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const canTakeAction = role === "admin" || role === "supervisor";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");


  const { data: violations = [] } = useQuery({
    queryKey: ["violations"],
    queryFn: async () =>
      (
        await supabase
          .from("violations")
          .select(
            "*, students(full_name, classes(name)), violation_types(name, severity), profiles!violations_created_by_fkey(full_name, username)"
          )
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").order("name")).data ??
      [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-with-class"],
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, full_name, class_id")
          .order("full_name")
      ).data ?? [],
  });

  const { data: types = [] } = useQuery({
    queryKey: ["violation_types"],
    queryFn: async () =>
      (
        await supabase
          .from("violation_types")
          .select("*")
          .order("severity")
          .order("name")
      ).data ?? [],
  });

  // من اتخذ الإجراء لكل مخالفة (آخر تعيين إجراء)
  const { data: actionBy = {} as Record<string, { name: string; at: string }> } = useQuery({
    queryKey: ["violation-action-takers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("violation_history")
        .select("violation_id, changed_by_name, created_at, action")
        .eq("action", "action_set")
        .order("created_at", { ascending: false });
      const map: Record<string, { name: string; at: string }> = {};
      (data ?? []).forEach((h: any) => {
        if (!map[h.violation_id]) map[h.violation_id] = { name: h.changed_by_name || "—", at: h.created_at };
      });
      return map;
    },
  });


  const filtered = violations.filter(
    (v: any) =>
      !search ||
      v.students?.full_name?.includes(search) ||
      v.violation_types?.name?.includes(search)
  );

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("violations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["violations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">المخالفات السلوكية</h1>
          <p className="text-muted-foreground mt-1">تسجيل ومتابعة المخالفات</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <ManageTypesDialog types={types} />}
          <AddViolationDialog
            classes={classes}
            students={students}
            types={types}
          />
        </div>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الطالب أو نوع المخالفة"
              className="pr-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right min-w-[140px]">الطالب</TableHead>
                    <TableHead className="text-right min-w-[100px]">الفصل</TableHead>
                    <TableHead className="text-right min-w-[200px]">نوع المخالفة</TableHead>
                    <TableHead className="text-right min-w-[100px]">التاريخ</TableHead>
                    <TableHead className="text-right min-w-[120px]">المسجّل</TableHead>
                    <TableHead className="text-right min-w-[160px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        لا توجد مخالفات
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((v: any) => {
                    const canEdit = isAdmin || v.created_by === user?.id;
                    const canDelete = isAdmin || v.created_by === user?.id;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="align-top">
                          <div className="font-bold whitespace-normal break-words leading-relaxed">
                            {v.students?.full_name || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary">
                            {v.students?.classes?.name || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1 items-start">
                              {v.violation_types?.severity && (
                                <Badge
                                  variant="outline"
                                  className={
                                    severityColor[v.violation_types.severity] ||
                                    ""
                                  }
                                >
                                  {v.violation_types.severity}
                                </Badge>
                              )}
                              {v.period && (
                                <Badge variant="outline">الحصة {v.period}</Badge>
                              )}
                              {v.action_taken ? (
                                <Badge
                                  className="bg-emerald-100 text-emerald-700 border-emerald-200"
                                  variant="outline"
                                >
                                  ✓ تم إجراء
                                </Badge>
                              ) : (
                                <Badge
                                  className="bg-amber-100 text-amber-700 border-amber-200"
                                  variant="outline"
                                >
                                  بانتظار
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-primary whitespace-normal break-words leading-relaxed">
                              {v.violation_types?.name || "—"}
                            </p>
                            {v.description && (
                              <p className="text-sm text-muted-foreground whitespace-normal break-words leading-relaxed">
                                {v.description}
                              </p>
                            )}
                            {v.action_taken && (
                              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-sm whitespace-normal break-words leading-relaxed">
                                <span className="text-emerald-700 font-medium">
                                  الإجراء: {" "}
                                </span>
                                <span>{v.action_taken}</span>
                                {actionBy[v.id] && (
                                  <span className="block text-xs text-muted-foreground mt-1">
                                    متخذ الإجراء: {actionBy[v.id].name} — {String(actionBy[v.id].at).slice(0, 10)}
                                  </span>
                                )}
                              </div>
                            )}

                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                          {v.violation_date}
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          <div className="whitespace-normal break-words leading-relaxed">
                            {v.profiles?.full_name ||
                              v.profiles?.username ||
                              "—"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex items-center gap-1 flex-wrap">
                            <HistoryDialog violation={v} />
                            {canTakeAction && <ActionTakenDialog violation={v} />}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("حذف المخالفة؟")) del.mutate(v.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddViolationDialog({
  classes,
  students,
  types,
}: {
  classes: any[];
  students: any[];
  types: any[];
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = {
    class_id: "",
    student_id: "",
    type_id: "",
    period: "",
    description: "",
    action_taken: "",
    violation_date: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState(initial);
  const qc = useQueryClient();

  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === form.class_id),
    [students, form.class_id]
  );
  const selectedType = useMemo(
    () => types.find((t) => t.id === form.type_id),
    [types, form.type_id]
  );

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("violations").insert({
        student_id: form.student_id,
        type_id: form.type_id || null,
        period: form.period ? Number(form.period) : null,
        description: form.description || null,
        action_taken: form.action_taken || null,
        violation_date: form.violation_date,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل المخالفة");
      qc.invalidateQueries({ queryKey: ["violations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm(initial);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setForm(initial);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 ml-1" /> تسجيل مخالفة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تسجيل مخالفة جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الصف *</Label>
            <Select
              value={form.class_id}
              onValueChange={(v) =>
                setForm({ ...form, class_id: v, student_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الصف أولاً" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الطالب *</Label>
            <Select
              value={form.student_id}
              onValueChange={(v) => setForm({ ...form, student_id: v })}
              disabled={!form.class_id}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    form.class_id
                      ? classStudents.length
                        ? "اختر الطالب"
                        : "لا يوجد طلاب في هذا الصف"
                      : "اختر الصف أولاً"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع المخالفة *</Label>
            <Select
              value={form.type_id}
              onValueChange={(v) => setForm({ ...form, type_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent className="max-w-[320px]">
                {types.map((t) => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    title={t.name}
                    className="whitespace-normal break-words leading-relaxed py-2"
                  >
                    <span className="block whitespace-normal break-words leading-relaxed">
                      {t.name}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      الدرجة {t.severity}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <Badge
                variant="outline"
                className={severityColor[selectedType.severity] || ""}
              >
                الدرجة {selectedType.severity}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الحصة</Label>
              <Select
                value={form.period}
                onValueChange={(v) => setForm({ ...form, period: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحصة" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      الحصة {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.violation_date}
                onChange={(e) =>
                  setForm({ ...form, violation_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => add.mutate()}
            disabled={!form.student_id || !form.type_id || add.isPending}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTypesDialog({ types }: { types: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<typeof DEGREES[number]>("الأولى");
  const [bulk, setBulk] = useState("");
  const [bulkSeverity, setBulkSeverity] =
    useState<typeof DEGREES[number]>("الأولى");
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("violation_types")
        .insert({ name, severity });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["violation_types"] });
      setName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addBulk = useMutation({
    mutationFn: async () => {
      const names = bulk
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (!names.length) throw new Error("لا توجد أسماء");
      const rows = names.map((n) => ({ name: n, severity: bulkSeverity }));
      const { error } = await supabase
        .from("violation_types")
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["violation_types"] });
      setBulk("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("violation_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["violation_types"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="w-4 h-4 ml-1" /> أنواع المخالفات
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>إدارة أنواع المخالفات</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المخالفة"
            />
            <Select
              value={severity}
              onValueChange={(v) =>
                setSeverity(v as typeof DEGREES[number])
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEGREES.map((d) => (
                  <SelectItem key={d} value={d}>
                    الدرجة {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => add.mutate()}
              disabled={!name || add.isPending}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">
              إضافة بالقص واللصق (نوع في كل سطر) — كلها بنفس الدرجة
            </Label>
            <Textarea
              rows={4}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"التأخر عن الطابور\nعدم إحضار الكتب\n..."}
            />
            <div className="flex gap-2">
              <Select
                value={bulkSeverity}
                onValueChange={(v) =>
                  setBulkSeverity(v as typeof DEGREES[number])
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEGREES.map((d) => (
                    <SelectItem key={d} value={d}>
                      الدرجة {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => addBulk.mutate()}
                disabled={!bulk.trim() || addBulk.isPending}
              >
                إضافة الكل
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto border-t pt-3">
            {types.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium whitespace-normal break-words leading-relaxed max-w-[220px]">
                    {t.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={severityColor[t.severity] || ""}
                  >
                    الدرجة {t.severity}
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("حذف؟")) del.mutate(t.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_PRESETS = [
  "تنبيه شفهي",
  "تعهد الطالب",
  "إحالة للمرشد الطلابي",
  "إحالة للإدارة",
  "حسم من درجات السلوك",
  "فصل",
  "تغيير بيئة صفية",
  "تغيير بيئة مدرسية",
];

function ActionTakenDialog({ violation }: { violation: any }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState(violation.action_taken || "");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("violations")
        .update({ action_taken: action || null })
        .eq("id", violation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الإجراء");
      qc.invalidateQueries({ queryKey: ["violations"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAction(violation.action_taken || "");
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="الإجراء المتخذ">
          <ClipboardEdit className="w-4 h-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            الإجراء المتخذ — {violation.students?.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {violation.violation_types?.name}
            {violation.violation_types?.severity &&
              ` — الدرجة ${violation.violation_types.severity}`}
          </div>
          <div className="space-y-2">
            <Label>اختيار سريع</Label>
            <div className="flex flex-wrap gap-1">
              {ACTION_PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setAction(action ? `${action} • ${p}` : p)
                  }
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>تفاصيل الإجراء</Label>
            <Textarea
              rows={4}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="اكتب الإجراء المتخذ..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {violation.action_taken && (
            <Button
              variant="outline"
              onClick={() => {
                setAction("");
                save.mutate();
              }}
              disabled={save.isPending}
            >
              إلغاء الإجراء
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_LABEL: Record<string, string> = {
  created: "تم إنشاء المخالفة",
  updated: "تم تعديل البيانات",
  action_set: "تم تسجيل/تحديث الإجراء",
  action_cleared: "تم إلغاء الإجراء",
};

function HistoryDialog({ violation }: { violation: any }) {
  const [open, setOpen] = useState(false);
  const {
    data: entries = [],
    isLoading,
  } = useQuery({
    queryKey: ["violation_history", violation.id],
    queryFn: async () =>
      (
        await supabase
          .from("violation_history")
          .select("*")
          .eq("violation_id", violation.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="سجل التغييرات">
          <History className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            سجل التغييرات — {violation.students?.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              جارٍ التحميل...
            </p>
          )}
          {!isLoading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد سجلات
            </p>
          )}
          {entries.map((e: any) => {
            const oldAct = e.old_data?.action_taken;
            const newAct = e.new_data?.action_taken;
            return (
              <div
                key={e.id}
                className="border-r-2 border-primary/40 pr-3 pb-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline">
                    {ACTION_LABEL[e.action] || e.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
                <p className="text-sm mt-1">👤 {e.changed_by_name || "—"}</p>
                {e.action === "action_set" && (
                  <div className="mt-1 text-sm space-y-1">
                    {oldAct && (
                      <p className="text-muted-foreground line-through">
                        {oldAct}
                      </p>
                    )}
                    <p className="text-emerald-700">{newAct}</p>
                  </div>
                )}
                {e.action === "action_cleared" && oldAct && (
                  <p className="mt-1 text-sm text-muted-foreground line-through">
                    {oldAct}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
