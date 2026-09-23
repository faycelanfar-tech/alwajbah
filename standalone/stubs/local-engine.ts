/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * محرك بيانات محلي بالكامل (LocalStorage) يحاكي واجهة supabase-js
 * تستخدمه النسخة المحمولة التي تُفتح بالنقر على index.html بدون إنترنت.
 */
import seed from "../seed-data.json";

const DB_KEY = "alwajbah.localdb.v1";
const SESSION_KEY = "alwajbah.localdb.session";
const STORAGE_KEY = "alwajbah.localdb.storage";
export const USERNAME_DOMAIN = "alwajbah.local";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

interface Account {
  id: string;
  username: string;
  password: string;
}

interface LocalDB {
  tables: Tables;
  accounts: Account[];
}

const ls = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* الذاكرة ممتلئة */
    }
  },
};

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seedDb(): LocalDB {
  const tables = JSON.parse(JSON.stringify(seed)) as Tables;
  const accounts: Account[] = (tables.profiles ?? []).map((p) => ({
    id: p.id,
    username: String(p.username ?? "").toLowerCase(),
    // كلمة المرور الافتراضية للنسخة المحلية = اسم المستخدم (يمكن تغييرها من داخل النظام)
    password: String(p.username ?? ""),
  }));
  return { tables, accounts };
}

let db: LocalDB = (() => {
  const raw = ls.get(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LocalDB;
      if (parsed?.tables) return parsed;
    } catch {
      /* تالف: نعيد التهيئة */
    }
  }
  const fresh = seedDb();
  ls.set(DB_KEY, JSON.stringify(fresh));
  return fresh;
})();

let saveTimer: number | undefined;
function persist() {
  if (typeof window === "undefined") return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => ls.set(DB_KEY, JSON.stringify(db)), 120);
}

function table(name: string): Row[] {
  if (name === "profiles_public") {
    return (db.tables.profiles ?? [])
      .filter((p) => p.username !== "admin")
      .map((p) => ({ id: p.id, username: p.username, full_name: p.full_name }));
  }
  if (!db.tables[name]) db.tables[name] = [];
  return db.tables[name];
}

export function exportAll() {
  return JSON.parse(JSON.stringify(db.tables)) as Tables;
}

export function importAll(tables: Tables) {
  db.tables = { ...db.tables, ...tables };
  persist();
}

/* ------------------------- العلاقات ------------------------- */

const FK: Record<string, Record<string, string>> = {
  students: { classes: "class_id" },
  violations: { students: "student_id", violation_types: "type_id" },
  positive_behaviors: { students: "student_id", positive_behavior_types: "type_id" },
  academic_reports: { students: "student_id", subjects: "subject_id" },
  point_transactions: { students: "student_id", classes: "class_id" },
  teacher_classes: { classes: "class_id" },
  teacher_subjects: { subjects: "subject_id" },
  participation_cycles: { classes: "class_id" },
  participation_entries: { students: "student_id" },
  class_weekly_points: { classes: "class_id" },
  student_points: { students: "student_id" },
};

const CHILDREN: Record<string, Record<string, string>> = {
  classes: { students: "class_id" },
};

interface Node {
  name: string;
  children?: Node[];
}

function parseSelect(sel: string): Node[] {
  const nodes: Node[] = [];
  let buf = "";
  let depth = 0;
  let inner = "";
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (depth > 0) {
      if (c === "(") depth++;
      if (c === ")") {
        depth--;
        if (depth === 0) {
          nodes.push({ name: buf.trim(), children: parseSelect(inner) });
          buf = "";
          inner = "";
          continue;
        }
      }
      inner += c;
      continue;
    }
    if (c === "(") {
      depth = 1;
      continue;
    }
    if (c === ",") {
      if (buf.trim()) nodes.push({ name: buf.trim() });
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) nodes.push({ name: buf.trim() });
  return nodes;
}

function project(tableName: string, row: Row, nodes: Node[]): Row {
  if (nodes.length === 1 && nodes[0].name === "*" && !nodes[0].children) return { ...row };
  const out: Row = {};
  for (const n of nodes) {
    if (n.name === "*") Object.assign(out, row);
    else if (n.children) out[n.name] = embed(tableName, row, n);
    else out[n.name] = row[n.name];
  }
  return out;
}

function embed(tableName: string, row: Row, node: Node): any {
  const fk = FK[tableName]?.[node.name];
  if (fk) {
    const parent = table(node.name).find((r) => r.id === row[fk]);
    return parent ? project(node.name, parent, node.children!) : null;
  }
  const childKey = CHILDREN[tableName]?.[node.name];
  if (childKey) {
    const kids = table(node.name).filter((r) => r[childKey] === row.id);
    if (node.children!.length === 1 && node.children![0].name === "count") return [{ count: kids.length }];
    return kids.map((k) => project(node.name, k, node.children!));
  }
  return null;
}

/* ------------------------- المرشحات ------------------------- */

type Filter = (row: Row) => boolean;

function cmp(op: string, a: any, b: any): boolean {
  switch (op) {
    case "eq":
      return String(a) === String(b);
    case "neq":
      return String(a) !== String(b);
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
    case "like":
    case "ilike": {
      const pat = String(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
      return new RegExp(`^${pat}$`, "i").test(String(a ?? ""));
    }
    case "is":
      return b === null ? a === null || a === undefined : a === b;
    default:
      return true;
  }
}

/* ------------------------- المشغلات (محاكاة) ------------------------- */

function currentUserId(): string | null {
  return session?.user?.id ?? null;
}

function actorName(): string {
  const uid = currentUserId();
  const p = table("profiles").find((r) => r.id === uid);
  return (p?.full_name || p?.username || "") as string;
}

function actorRole(): string | null {
  const uid = currentUserId();
  return (table("user_roles").find((r) => r.user_id === uid)?.role as string) ?? null;
}

function logActivity(action: string, entity: string, row: Row) {
  table("activity_log").unshift({
    id: uuid(),
    actor_id: currentUserId(),
    actor_name: actorName(),
    actor_role: actorRole(),
    action,
    entity,
    entity_id: row?.id ?? null,
    summary: row?.full_name ?? row?.name ?? row?.text ?? row?.school_name ?? null,
    details: row ?? null,
    created_at: new Date().toISOString(),
  });
  db.tables.activity_log = table("activity_log").slice(0, 500);
}

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function addPoints(studentId: string, delta: number, reason: string, kind: string) {
  const sp = table("student_points").find((r) => r.student_id === studentId);
  if (sp) sp.points = (sp.points ?? 50) + delta;
  else table("student_points").push({ student_id: studentId, points: 50 + delta, updated_at: new Date().toISOString() });

  const classId = table("students").find((s) => s.id === studentId)?.class_id ?? null;
  table("point_transactions").unshift({
    id: uuid(),
    student_id: studentId,
    class_id: classId,
    delta,
    reason,
    kind,
    created_by: currentUserId(),
    created_at: new Date().toISOString(),
  });
  if (classId) {
    const wk = weekStart();
    const cw = table("class_weekly_points").find((r) => r.class_id === classId && r.week_start === wk);
    if (cw) cw.points = (cw.points ?? 300) + delta;
    else
      table("class_weekly_points").push({
        id: uuid(),
        class_id: classId,
        week_start: wk,
        points: 300 + delta,
        updated_at: new Date().toISOString(),
      });
  }
}

function notifySupervisors(kind: string, title: string, body: string, link: string) {
  const targets = table("user_roles").filter((r) => r.role === "admin" || r.role === "supervisor");
  for (const t of targets) {
    table("notifications").unshift({
      id: uuid(),
      user_id: t.user_id,
      kind,
      title,
      body,
      link,
      read: false,
      created_at: new Date().toISOString(),
    });
  }
  db.tables.notifications = table("notifications").slice(0, 300);
}

const SEVERITY_DELTA: Record<string, number> = { "الأولى": -1, "الثانية": -2, "الثالثة": -5, "الرابعة": -10 };

function afterInsert(name: string, row: Row) {
  if (name === "violations") {
    const sev = table("violation_types").find((t) => t.id === row.type_id)?.severity as string | undefined;
    const delta = sev ? SEVERITY_DELTA[sev] ?? -1 : -1;
    addPoints(row.student_id, delta, `مخالفة درجة ${sev ?? "غير محدد"}`, "violation");
    const student = table("students").find((s) => s.id === row.student_id)?.full_name ?? "طالب";
    notifySupervisors("pending_action", "مخالفة بانتظار إجراء", `${student} — تم تسجيل مخالفة جديدة`, "/actions");
    table("violation_history").unshift({
      id: uuid(),
      violation_id: row.id,
      action: "created",
      changed_by: currentUserId(),
      changed_by_name: actorName(),
      new_data: row,
      created_at: new Date().toISOString(),
    });
  }
  if (name === "positive_behaviors") {
    const pts = row.points ?? 1;
    addPoints(row.student_id, pts, "سلوك إيجابي", "positive");
  }
  logActivity("created", name, row);
}

function afterUpdate(name: string, oldRow: Row, row: Row) {
  if (name === "violations") {
    const action =
      oldRow.action_taken !== row.action_taken ? (row.action_taken ? "action_set" : "action_cleared") : "updated";
    table("violation_history").unshift({
      id: uuid(),
      violation_id: row.id,
      action,
      changed_by: currentUserId(),
      changed_by_name: actorName(),
      old_data: oldRow,
      new_data: row,
      created_at: new Date().toISOString(),
    });
    if (action === "action_set" && row.created_by && row.created_by !== currentUserId()) {
      const student = table("students").find((s) => s.id === row.student_id)?.full_name ?? "طالب";
      table("notifications").unshift({
        id: uuid(),
        user_id: row.created_by,
        kind: "action_taken",
        title: "تم اتخاذ إجراء",
        body: `${student} — ${row.action_taken}`,
        link: "/violations",
        read: false,
        created_at: new Date().toISOString(),
      });
    }
  }
  logActivity("updated", name, row);
}

function afterDelete(name: string, row: Row) {
  if (name === "violations") {
    table("violation_history").unshift({
      id: uuid(),
      violation_id: row.id,
      action: "deleted",
      changed_by: currentUserId(),
      changed_by_name: actorName(),
      old_data: row,
      created_at: new Date().toISOString(),
    });
  }
  logActivity("deleted", name, row);
}

/* ------------------------- منشئ الاستعلام ------------------------- */

class Query implements PromiseLike<any> {
  private filters: Filter[] = [];
  private sel = "*";
  private countMode: string | null = null;
  private headOnly = false;
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private conflict = "id";
  private singleMode: "single" | "maybe" | null = null;

  constructor(private name: string) {}

  select(sel = "*", opts?: { count?: string; head?: boolean }) {
    this.sel = sel || "*";
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(payload: any) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = payload;
    if (opts?.onConflict) this.conflict = opts.onConflict;
    return this;
  }
  update(payload: any) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  eq(c: string, v: any) { return this.add((r) => cmp("eq", r[c], v)); }
  neq(c: string, v: any) { return this.add((r) => cmp("neq", r[c], v)); }
  gt(c: string, v: any) { return this.add((r) => cmp("gt", r[c], v)); }
  gte(c: string, v: any) { return this.add((r) => cmp("gte", r[c], v)); }
  lt(c: string, v: any) { return this.add((r) => cmp("lt", r[c], v)); }
  lte(c: string, v: any) { return this.add((r) => cmp("lte", r[c], v)); }
  like(c: string, v: any) { return this.add((r) => cmp("like", r[c], v)); }
  ilike(c: string, v: any) { return this.add((r) => cmp("ilike", r[c], v)); }
  is(c: string, v: any) { return this.add((r) => cmp("is", r[c], v)); }
  in(c: string, vals: any[]) { return this.add((r) => (vals ?? []).some((v) => String(v) === String(r[c]))); }
  contains(c: string, v: any) { return this.add((r) => JSON.stringify(r[c] ?? "").includes(String(v))); }
  not(c: string, op: string, v: any) { return this.add((r) => !cmp(op, r[c], v)); }
  match(obj: Row) { return this.add((r) => Object.entries(obj).every(([k, v]) => cmp("eq", r[k], v))); }
  filter(c: string, op: string, v: any) { return this.add((r) => cmp(op, r[c], v)); }
  or(expr: string) {
    const parts = expr.split(",").map((p) => p.split("."));
    return this.add((r) => parts.some(([c, op, v]) => cmp(op, r[c], v === "null" ? null : v)));
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rangeFrom = a; this.rangeTo = b; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  private add(f: Filter) {
    this.filters.push(f);
    return this;
  }

  private matching(rows: Row[]) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private run() {
    const name = this.name;
    const rows = table(name);
    let affected: Row[] = [];

    if (this.mode === "insert" || this.mode === "upsert") {
      const items: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const keys = this.conflict.split(",").map((k) => k.trim());
      for (const item of items) {
        const record: Row = { ...item };
        if (this.mode === "upsert") {
          const existing = rows.find((r) => keys.every((k) => String(r[k]) === String(record[k])));
          if (existing) {
            Object.assign(existing, record, { updated_at: new Date().toISOString() });
            affected.push(existing);
            logActivity("updated", name, existing);
            continue;
          }
        }
        if (record.id === undefined) record.id = uuid();
        if (record.created_at === undefined) record.created_at = new Date().toISOString();
        rows.push(record);
        affected.push(record);
        afterInsert(name, record);
      }
      persist();
    } else if (this.mode === "update") {
      for (const r of this.matching(rows)) {
        const old = { ...r };
        Object.assign(r, this.payload);
        affected.push(r);
        afterUpdate(name, old, r);
      }
      persist();
    } else if (this.mode === "delete") {
      const doomed = this.matching(rows);
      for (const r of doomed) {
        const i = rows.indexOf(r);
        if (i >= 0) rows.splice(i, 1);
        afterDelete(name, r);
      }
      affected = doomed;
      persist();
    } else {
      affected = this.matching(rows);
    }

    const count = affected.length;
    if (this.headOnly) return { data: null, error: null, count, status: 200, statusText: "OK" };

    let list = affected;
    if (this.orders.length) {
      list = [...list].sort((a, b) => {
        for (const o of this.orders) {
          const av = a[o.col];
          const bv = b[o.col];
          if (av === bv) continue;
          const r = av === null || av === undefined ? -1 : bv === null || bv === undefined ? 1 : av > bv ? 1 : -1;
          return o.asc ? r : -r;
        }
        return 0;
      });
    }
    if (this.rangeFrom !== null) list = list.slice(this.rangeFrom, (this.rangeTo ?? list.length) + 1);
    if (this.lim !== null) list = list.slice(0, this.lim);

    const nodes = parseSelect(this.sel);
    const data = list.map((r) => project(name, r, nodes));

    if (this.singleMode) {
      if (data.length === 0)
        return this.singleMode === "single"
          ? { data: null, error: { message: "لا توجد نتائج" }, count, status: 406, statusText: "Not Found" }
          : { data: null, error: null, count, status: 200, statusText: "OK" };
      return { data: data[0], error: null, count, status: 200, statusText: "OK" };
    }
    return { data, error: null, count: this.countMode ? count : null, status: 200, statusText: "OK" };
  }

  then(onOk?: (v: any) => any, onErr?: (e: any) => any) {
    try {
      return Promise.resolve(this.run()).then(onOk, onErr);
    } catch (e: any) {
      return Promise.resolve({ data: null, error: { message: e?.message ?? String(e) } }).then(onOk, onErr);
    }
  }
}

/* ------------------------- المصادقة ------------------------- */

interface LocalSession {
  access_token: string;
  user: { id: string; email: string; app_metadata: Record<string, never>; user_metadata: Record<string, never>; aud: string; created_at: string };
}

let session: LocalSession | null = (() => {
  const raw = ls.get(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
})();

type AuthListener = (event: string, session: LocalSession | null) => void;
const authListeners = new Set<AuthListener>();

function emitAuth(event: string) {
  authListeners.forEach((l) => l(event, session));
}

function setSession(next: LocalSession | null) {
  session = next;
  if (next) ls.set(SESSION_KEY, JSON.stringify(next));
  else ls.set(SESSION_KEY, "");
}

function makeSession(account: Account): LocalSession {
  return {
    access_token: `local-${account.id}`,
    user: {
      id: account.id,
      email: `${account.username}@${USERNAME_DOMAIN}`,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  };
}

export function listAccounts() {
  return db.accounts;
}

export function createLocalAccount(username: string, password: string) {
  const uname = username.trim().toLowerCase();
  if (db.accounts.some((a) => a.username === uname)) throw new Error("اسم المستخدم مستخدم مسبقاً");
  const account: Account = { id: uuid(), username: uname, password };
  db.accounts.push(account);
  persist();
  return account;
}

export function deleteLocalAccount(userId: string) {
  db.accounts = db.accounts.filter((a) => a.id !== userId);
  persist();
}

export function setLocalPassword(userId: string, password: string) {
  const acc = db.accounts.find((a) => a.id === userId);
  if (!acc) throw new Error("الحساب غير موجود");
  acc.password = password;
  persist();
}

const auth = {
  async getSession() {
    return { data: { session }, error: null };
  },
  async getUser() {
    return { data: { user: session?.user ?? null }, error: null };
  },
  onAuthStateChange(cb: AuthListener) {
    authListeners.add(cb);
    setTimeout(() => cb("INITIAL_SESSION", session), 0);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const uname = String(email).split("@")[0].toLowerCase();
    const acc = db.accounts.find((a) => a.username === uname);
    if (!acc || acc.password !== password) {
      return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
    }
    setSession(makeSession(acc));
    emitAuth("SIGNED_IN");
    return { data: { user: session!.user, session }, error: null };
  },
  async signOut() {
    setSession(null);
    emitAuth("SIGNED_OUT");
    return { error: null };
  },
  async updateUser({ password }: { password?: string; current_password?: string }) {
    if (!session) return { data: { user: null }, error: { message: "لا توجد جلسة" } };
    if (password) setLocalPassword(session.user.id, password);
    return { data: { user: session.user }, error: null };
  },
  async resetPasswordForEmail() {
    return { data: null, error: { message: "استعادة كلمة المرور بالبريد غير متاحة في النسخة المحلية." } };
  },
};

/* ------------------------- التخزين (الشعار) ------------------------- */

function readStorage(): Record<string, string> {
  try {
    return JSON.parse(ls.get(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const all = readStorage();
        all[`${bucket}/${path}`] = dataUrl;
        ls.set(STORAGE_KEY, JSON.stringify(all));
        return { data: { path }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: readStorage()[`${bucket}/${path}`] ?? "" } };
      },
      async remove() {
        return { data: null, error: null };
      },
    };
  },
};

/* ------------------------- العميل ------------------------- */

export const localClient: any = {
  from: (name: string) => new Query(name),
  auth,
  storage,
  rpc: async (fn: string) => {
    if (fn === "record_login" && session) {
      const p = table("profiles").find((r) => r.id === session!.user.id);
      if (p) p.last_login_at = new Date().toISOString();
      logActivity("login", "auth", { id: session.user.id });
      persist();
    }
    return { data: null, error: null };
  },
  channel: () => {
    const chan: any = { on: () => chan, subscribe: () => chan, unsubscribe: () => {} };
    return chan;
  },
  removeChannel: () => {},
};
