import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Publiczne odczyty treści stron (nadpisania bloków rejestru treści).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const content = await runSql(
      base44,
      `SELECT page_key, block_key, value
       FROM public.page_content`,
      true
    );
    return Response.json({ content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}