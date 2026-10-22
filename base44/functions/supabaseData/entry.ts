// Bramka danych z kopii Supabase dla zalogowanych (dane kont i panele).
// Reguły dostępu egzekwują moduły supaRead (odczyt) i supaWrite (zapis) —
// identycznie jak reguły encji aplikacji.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { supaRead } from '../../shared/supaRead.ts';
import { supaWrite } from '../../shared/supaWrite.ts';

const READ_OPS = new Set(["get", "filter", "list", "count", "aggregate"]);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Logowanie wymagane' }, { status: 401 });

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload.entity !== 'string' || typeof payload.op !== 'string') {
      return Response.json({ error: 'Błędne żądanie' }, { status: 400 });
    }

    const result = READ_OPS.has(payload.op)
      ? await supaRead(base44, user, payload)
      : await supaWrite(base44, user, payload);
    return Response.json({ ok: true, result });
  } catch (e) {
    const forbidden = e && e.forbidden === true;
    console.error('supabaseData:', String(e?.message || e).slice(0, 200));
    return Response.json(
      { error: forbidden ? 'Brak dostępu' : 'Operacja na kopii nie powiodła się' },
      { status: forbidden ? 403 : 500 }
    );
  }
}