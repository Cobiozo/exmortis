import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, requireAdmin, clientIp } from "../../shared/supabase.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { createBackup, KEEP } from "../../shared/backup.ts";

// Kopie zapasowe: lista, pobranie (podpisany link 5 minut) i wykonanie na żądanie.
// Dostęp: administrator, a dla zadania tygodniowego — token zadania z mb_settings (jak libraryTick).

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    // Zadanie tygodniowe z cronTick — bez sesji administratora, po tokenie zadania.
    if (action === "weekly") {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows && rows[0] ? rows[0].tick_token : null;
      const given = typeof body.tick_token === "string" ? body.tick_token : "";
      const who = await base44.auth.me().catch(() => null);
      if (who?.role !== "admin" && (!stored || !given || !safeEqual(given, stored))) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const r = await createBackup(base44, { kto: "zadanie tygodniowe" });
      console.log("backupAdmin weekly", JSON.stringify({ size: r.size, rows: r.rows, format: r.format }));
      return Response.json(r);
    }

    const me = await requireAdmin(base44);

    if (action === "list") {
      const list = await base44.asServiceRole.entities.BackupFile.list("-created_date", KEEP + 12);
      const items = (Array.isArray(list) ? list : list.items || []).map((b) => ({
        id: b.id,
        size: b.size || 0,
        format: b.format || "json",
        rows: b.rows || 0,
        tables: Array.isArray(b.tables) ? b.tables : [],
        status: b.status || "gotowa",
        blad: b.blad || "",
        kto: b.kto || "",
        created_at: b.created_at || b.created_date || null,
      }));
      return Response.json({ items, keep: KEEP });
    }

    if (action === "now") {
      const r = await createBackup(base44, { kto: me.email || "panel" });
      return Response.json(r);
    }

    if (action === "download") {
      const id = String(body.id || "");
      const rec = await base44.asServiceRole.entities.BackupFile.get(id).catch(() => null);
      if (!rec || !rec.file_uri) return Response.json({ error: "Nie ma takiej kopii" }, { status: 404 });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: rec.file_uri,
        expires_in: 300,
      });
      await base44.asServiceRole.entities.SecurityLog.create({
        type: "kopia",
        user_email: me.email || "",
        ip: clientIp(req),
        details: `Pobranie kopii zapasowej · ${(Number(rec.size) / 1024 / 1024).toFixed(1)} MB · ${rec.format || "json"}`,
      }).catch(() => {});
      const stamp = String(rec.created_at || rec.created_date || "").slice(0, 10);
      return Response.json({ url: signed_url, name: `exmortis-kopia-${stamp}.${rec.format || "json"}` });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    console.error("backupAdmin:", String((error && error.message) || error).slice(0, 300));
    return Response.json({ error: error.message }, { status: 500 });
  }
}