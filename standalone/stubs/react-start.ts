// بديل مبسّط لحزمة TanStack Start داخل النسخة التي تعمل بفتح الملف مباشرة.
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
