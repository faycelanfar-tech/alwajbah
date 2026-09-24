/* eslint-disable @typescript-eslint/no-explicit-any */
// بديل عميل الخادم: محرك محلي بالكامل يعمل على ذاكرة المتصفح.
import { localClient } from "./local-engine";

export const supabase: any = localClient;
export const supabaseAdmin: any = localClient;
export default localClient;
