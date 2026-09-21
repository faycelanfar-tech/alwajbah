import { ReactNode, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";

/**
 * يحفظ نتائج كل الاستعلامات في ذاكرة الجهاز (IndexedDB)
 * ليعمل النظام ويعرض البيانات كاملة حتى بدون إنترنت.
 */
export function OfflineQueryProvider({ client, children }: { client: QueryClient; children: ReactNode }) {
  const persister = useMemo(() => {
    if (typeof window === "undefined") return null;
    const store = createStore("alwajbah-query-cache", "cache");
    return createAsyncStoragePersister({
      storage: {
        getItem: (key) => get(key, store).then((v) => (v == null ? null : (v as string))),
        setItem: (key, value) => set(key, value, store),
        removeItem: (key) => del(key, store),
      },
      key: "alwajbah-rq",
      throttleTime: 1000,
    });
  }, []);

  if (!persister) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 30, buster: "v1" }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
