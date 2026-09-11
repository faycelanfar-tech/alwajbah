import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseScoreText, matchScores, readScoreFile, type MatchResult, type StudentLike } from "@/lib/score-import";

interface Props {
  students: StudentLike[];
  onApply: (scores: { studentId: string; score: number }[]) => void;
}

export function PasteScoresDialog({ students, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = (value: string) => {
    setText(value);
    if (!value.trim()) return setResult(null);
    setResult(matchScores(parseScoreText(value), students));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      analyze(await readScoreFile(file));
    } catch {
      toast.error("تعذّرت قراءة الملف، تأكد من صيغته (Excel أو Word أو CSV)");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result?.matched.length) return;
    onApply(result.matched.map((m) => ({ studentId: m.studentId, score: m.score })));
    toast.success(`تم إدخال ${result.matched.length} درجة`);
    setOpen(false);
    setText("");
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ClipboardPaste className="w-4 h-4 ml-2" /> لصق الدرجات</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>إدخال الدرجات بالّلصق أو من ملف</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Label htmlFor="score-file" className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} رفع ملف Excel أو Word
            </Label>
            <input
              id="score-file"
              type="file"
              accept=".xlsx,.xls,.csv,.docx"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="text-xs text-muted-foreground">أو الصق القائمة في الأسفل</span>
          </div>

          <Textarea
            rows={8}
            dir="rtl"
            placeholder={"محمد أحمد\t18\nسارة علي\t15\n\nيمكن أيضاً لصق عمود الدرجات فقط بنفس ترتيب الطلاب"}
            value={text}
            onChange={(e) => analyze(e.target.value)}
          />

          {result && (
            <div className="rounded-lg border p-3 text-sm space-y-2 max-h-56 overflow-auto">
              <p className="font-medium text-emerald-600">تمت مطابقة {result.matched.length} طالباً</p>
              {result.unmatched.length > 0 && (
                <div>
                  <p className="font-medium text-amber-600">لم تتم مطابقة {result.unmatched.length}:</p>
                  <p className="text-xs text-muted-foreground">{result.unmatched.map((u) => u.name).join("، ")}</p>
                </div>
              )}
              {result.invalid.length > 0 && (
                <div>
                  <p className="font-medium text-destructive">أسطر غير مفهومة ({result.invalid.length}):</p>
                  <p className="text-xs text-muted-foreground">{result.invalid.slice(0, 5).join(" | ")}</p>
                </div>
              )}
              {result.matched.length > 0 && (
                <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-3">
                  {result.matched.slice(0, 20).map((m) => (
                    <li key={m.studentId}>{m.name}: {m.score}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={apply} disabled={!result?.matched.length}>تطبيق الدرجات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
