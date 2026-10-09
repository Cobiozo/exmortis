import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { publicSettings } from "../../shared/publicData.ts";

// Publiczne ustawienia strony: dane firmy i tryb przedpremierowy.
export default async function (req) {
  try {
    return Response.json(await publicSettings(createClientFromRequest(req), req));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}