import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { publicContent } from "../../shared/publicData.ts";

// Publiczne odczyty treści stron — z kopii w bazie aplikacji, odświeżanej z Supabase w tle.
export default async function (req) {
  try {
    return Response.json({ content: await publicContent(createClientFromRequest(req)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}