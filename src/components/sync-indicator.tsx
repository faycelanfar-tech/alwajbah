import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { isOnline, isSyncing, readOutbox, subscribeOffline, syncOutbox, startSyncEngine } from "@/lib/db";
import { toast } from "sonner";

export function SyncIndicator() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const list = await readOutbox();
      if (!alive) return;
      setPending(list.length);
      setOnline(isOnline());
      setBusy(isSyncing());
    };
    const unsub = subscribeOffline(() => void refresh());
    const stop = startSyncEngine(() => {
      qc.invalidateQueries();
      void refresh();
    });
    void refresh();
    const t = window.setInterval(refresh, 5000);
    return () => {
      alive = false;
      unsub();
      stop();
      window.clearInterval(t);
    };
  }, [qc]);

  async function syncNow() {
    if (!isOnline()) {
      toast.error("لا يوجد اتصال بالإنترنت حالياً");
      return;
    }
    setBusy(true);
    const res = await syncOutbox();
    setBusy(false);
    qc.invalidateQueries();
    if (res.failed > 0) toast.error(`تعذّر إرسال ${res.failed} تغيير`);
    else toast.success(res.pushed > 0 ? `تمت مزامنة ${res.pushed} تغيير` : "كل شيء محدّث");
  }

  const label = !online ? "غير متصل" : busy ? "جاري المزامنة" : pending > 0 ? `${pending} بانتظار المزامنة` : "متصل";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={syncNow}
      title={label}
      className={`gap-1 ${!online ? "text-destructive" : pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}
    >
      {busy ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : online ? (
        <Cloud className="w-4 h-4" />
      ) : (
        <CloudOff className="w-4 h-4" />
      )}
      <span className="hidden md:inline text-xs">{label}</span>
    </Button>
  );
}
