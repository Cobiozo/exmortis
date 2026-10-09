import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Publiczne odczyty treści stron (nadpisania bloków rejestru treści), pamięć 60 s w instancji.
let CACHE: { v: unknown; at: number } | null = null;

export default async function (req) {
  try {
    if (!CACHE || Date.now() - CACHE.at > 60000) {
      const base44 = createClientFromRequest(req);
      const content = await runSql(base44, `SELECT page_key, block_key, value FROM public.page_content`, true);
      CACHE = { v: content, at: Date.now() };
    }
    return Response.json({ content: CACHE.v });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}