// Przenosi jeden rekord (zapis/usunięcie z interfejsu) do kopii Supabase natychmiast po zapisie,
// żeby panele i konto czytające z kopii widziały zmianę od razu, bez czekania na tick co 5 minut.
// Może to wywołać obsługa (admin/techniczna) albo właściciel rekordu — nikt inny.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { mirrorRecord } from '../../shared/mirror.ts';
import { REPLICATE, TABLE } from '../../shared/replicate.ts';
import { runSql, escStr } from '../../shared/supabase.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Logowanie wymagane' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const entity = body?.entity;
    const id = typeof body?.id === 'string' ? body.id : '';
    const action = body?.action === 'delete' ? 'delete' : 'upsert';
    if (!REPLICATE.includes(entity) || !id) {
      return Response.json({ error: 'Błędne żądanie' }, { status: 400 });
    }

    const isStaff = user.role === 'admin' || user.role === 'techniczna';
    const rec = await base44.asServiceRole.entities[entity].get(id).catch(() => null);
    if (!isStaff && (!rec || rec.created_by_id !== user.id)) {
      return Response.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    if (action === 'delete' || !rec) {
      await runSql(base44, `DELETE FROM public.${TABLE(entity)} WHERE id = ${escStr(id)}`);
    } else {
      await mirrorRecord(base44, entity, id);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('replicateOne:', String(e?.message || e).slice(0, 200));
    return Response.json({ error: 'Przeniesienie nie powiodło się' }, { status: 500 });
  }
}