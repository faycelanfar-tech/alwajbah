/** أدوات استيراد درجات الطلاب من نص ملصوق أو من ملف Excel/Word */

export interface ParsedRow {
  name: string;
  score: number;
}

export interface MatchResult {
  matched: { studentId: string; name: string; score: number }[];
  unmatched: { name: string; score: number }[];
  invalid: string[];
}

const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/** تطبيع الاسم العربي: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة والمسافات */
export function normalizeName(raw: string) {
  return String(raw ?? "")
    .replace(AR_DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const toNumber = (v: string) => {
  // تحويل الأرقام العربية إلى إنجليزية
  const s = String(v ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/,/g, ".")
    .trim();
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

const splitCells = (line: string) =>
  line
    .split(/\t|;|,|\s{2,}|\|/)
    .map((c) => c.trim())
    .filter((c) => c !== "");

/** تحليل نص ملصوق إلى أزواج (اسم، درجة)، أو قائمة درجات فقط */
export function parseScoreText(text: string): { rows: ParsedRow[]; scoresOnly: number[]; invalid: string[] } {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedRow[] = [];
  const scoresOnly: number[] = [];
  const invalid: string[] = [];

  for (const line of lines) {
    let cells = splitCells(line);
    if (cells.length === 1) {
      // ربما "الاسم 18" مفصولة بمسافة واحدة
      const m = line.match(/^(.*?)[\s:]+(\S+)$/);
      if (m && toNumber(m[2]) !== null && normalizeName(m[1])) cells = [m[1].trim(), m[2]];
    }

    if (cells.length === 1) {
      const only = toNumber(cells[0]);
      if (only !== null) scoresOnly.push(only);
      else invalid.push(line);
      continue;
    }

    // ابحث عن أول خلية رقمية كدرجة، وباقي الخلايا اسم
    const numIdx = cells.findIndex((c, i) => i > 0 && toNumber(c) !== null);
    if (numIdx === -1) {
      invalid.push(line);
      continue;
    }
    const score = toNumber(cells[numIdx])!;
    const nameParts = cells.slice(0, numIdx).filter((c) => toNumber(c) === null || c.length > 4);
    const name = (nameParts.join(" ") || cells[0]).trim();
    if (!normalizeName(name)) {
      invalid.push(line);
      continue;
    }
    rows.push({ name, score });
  }

  // تجاهل صف العناوين إن وُجد
  return { rows, scoresOnly, invalid: invalid.filter((l) => !/الاسم|الطالب|name|الدرجة/i.test(l)) };
}

export interface StudentLike {
  id: string;
  full_name: string;
  student_number?: string | null;
}

/** مطابقة الأزواج المحلّلة مع قائمة الطلاب */
export function matchScores(
  parsed: { rows: ParsedRow[]; scoresOnly: number[]; invalid: string[] },
  students: StudentLike[],
): MatchResult {
  const byName = new Map<string, StudentLike>();
  const byNumber = new Map<string, StudentLike>();
  students.forEach((s) => {
    byName.set(normalizeName(s.full_name), s);
    if (s.student_number) byNumber.set(String(s.student_number).trim(), s);
  });

  const matched: MatchResult["matched"] = [];
  const unmatched: MatchResult["unmatched"] = [];
  const used = new Set<string>();

  for (const row of parsed.rows) {
    const key = normalizeName(row.name);
    let student = byName.get(key) || byNumber.get(row.name.trim());
    if (!student) {
      // مطابقة جزئية: احتواء الاسم
      const candidates = students.filter((s) => {
        const n = normalizeName(s.full_name);
        return n === key || n.startsWith(key) || key.startsWith(n);
      });
      if (candidates.length === 1) student = candidates[0];
    }
    if (student && !used.has(student.id)) {
      used.add(student.id);
      matched.push({ studentId: student.id, name: student.full_name, score: row.score });
    } else {
      unmatched.push({ name: row.name, score: row.score });
    }
  }

  // درجات بلا أسماء: تُطبَّق بالترتيب على الطلاب غير المطابقين
  if (matched.length === 0 && parsed.scoresOnly.length) {
    parsed.scoresOnly.forEach((score, i) => {
      const s = students[i];
      if (s) matched.push({ studentId: s.id, name: s.full_name, score });
    });
  }

  return { matched, unmatched, invalid: parsed.invalid };
}

/** قراءة ملف Excel/CSV أو Word وتحويله إلى نص جدولي */
export async function readScoreFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const res = await (mammoth as any).extractRawText({ arrayBuffer: buf });
    return String(res?.value ?? "");
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    return rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))).join("\t")).join("\n");
  }
  return await file.text();
}
