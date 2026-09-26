import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, FolderSync, HardDrive } from "lucide-react";
import { toast } from "sonner";
import {
  sharedMode, reloadFromShared, subscribeShared, getLastSync,
  getSharedPath, setSharedPath, chooseSharedPath,
} from "./local-engine";

const POLL_MS = 5000;

/** تحديث تلقائي كل 5 ثوانٍ من الملف المشترك + زر تحديث يدوي + ضبط مسار الملف */
export function SyncIndicator() {
  const qc = useQueryClient();
  const [last, setLast] = useState(() => getLastSync());
  const [path, setPath] = useState(() => getSharedPath());

  useEffect(() => {
    const unsub = subscribeShared(() => qc.invalidateQueries());
    const t = window.setInterval(() => {
      reloadFromShared();
      setLast(getLastSync());
    }, POLL_MS);
    return () => { unsub(); window.clearInterval(t); };
  }, [qc]);

  function refreshNow() {
    if (sharedMode) reloadFromShared(true);
    qc.invalidateQueries();
    setLast(Date.now());
    toast.success("تم تحديث البيانات");
  }

  const time = new Date(last).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex items-center">
      <Button variant="ghost" size="sm" onClick={refreshNow} title={`آخر تحديث ${time}`} className="gap-1 text-muted-foreground">
        <RefreshCw className="w-4 h-4" />
        <span className="hidden md:inline text-xs">تحديث · {time}</span>
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title={sharedMode ? "ملف البيانات المشترك" : "تخزين محلي"}>
            {sharedMode ? <FolderSync className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مكان حفظ البيانات</DialogTitle></DialogHeader>
          {sharedMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ضع مسار ملف البيانات داخل مجلد الشبكة المشترك، ليرى جميع المعلمين والمشرفين البيانات نفسها.
              </p>
              <Input dir="ltr" value={path} onChange={(e) => setPath(e.target.value)} placeholder="\\SERVER\SchoolShare\alwajbah-data.json" />
              <div className="flex gap-2">
                <Button onClick={() => { if (setSharedPath(path.trim())) { qc.invalidateQueries(); toast.success("تم حفظ المسار"); } else toast.error("تعذّر استخدام هذا المسار"); }}>حفظ المسار</Button>
                <Button variant="outline" onClick={() => { const p = chooseSharedPath(); if (p) { setPath(p); qc.invalidateQueries(); } }}>اختيار ملف…</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              النظام يعمل الآن من المتصفح، والبيانات محفوظة على هذا الجهاز فقط. لمشاركة البيانات عبر شبكة المدرسة شغّل النظام كتطبيق سطح مكتب (ملف «تشغيل» المرفق).
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
