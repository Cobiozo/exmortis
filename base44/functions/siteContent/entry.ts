import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { getSnap } from "../../shared/snapshot.ts";

// Publiczne odczyty treści stron — z kopii w bazie aplikacji, odświeżanej z Supabase w tle.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const content = await getSnap(base44, "content", () =>
      runSql(base44, `SELECT page_key, block_key, value FROM public.page_content`, true));
    return Response.json({ content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}