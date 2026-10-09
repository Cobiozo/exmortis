import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { waitUntil } from "base44:runtime";
import { getSetting, loadAppUrl, APP_URL as APP } from "../../shared/settings.ts";
import { sendMail as gate, adminTo } from "../../shared/smtp.ts";
const sendMail = (b, m) => gate(b, { kind: "podcast", ...m });

const CRISIS = [/nie chc[eę] (już )?żyć/i, /skończyć ze sobą/i, /samob[oó]j/i, /zabić si[eę]/i, /samookalecz/i, /odebrać sobie życie/i];
const HELP = `<p style="font-size:18px;color:#C9A24A;line-height:1.7"><b>116 123</b> · <b>800 70 2222</b> (całą dobę, bezpłatnie) · <b>112</b></p>`;
const wrap = (body) => `<div style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;padding:32px;max-width:560px">${body}<hr style="border:none;border-top:1px solid #3D3D3F;margin:28px 0"><p style="font-size:12px;color:#8A8A8C">W kryzysie: 116 123 · 800 70 2222 · 112</p></div>`;

const str = (v, max, req) => {
  const s = String(v ?? "").trim();
  if (req && !s) throw new Error("Uzupełnij wymagane pola.");
  if (s.length > max) throw new Error("Tekst jest za długi.");
  return s;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const b = await req.json().catch(() => ({}));
    const email = str(b.email, 200, true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Nieprawidłowy adres e-mail.");
    const story = str(b.story, 2000, true);
    if (story.length < 200) throw new Error("Opowiedz swoją drogę w co najmniej 200 znakach.");
    if (!["mentalna", "duchowa", "zyciowa", "trudno"].includes(b.smierc)) throw new Error("Wybierz rodzaj śmierci.");
    if (!["pelne", "imie", "pseudonim", "anonimowo"].includes(b.forma)) throw new Error("Wybierz formę wystąpienia.");
    if (b.consent_adult !== true || b.consent_art9 !== true) throw new Error("Zaznacz wymagane zgody.");
    const today = str(b.today, 500, true);
    const now = new Date().toISOString();
    const pilne = CRISIS.some((r) => r.test(`${story} ${today}`));

    const rec = await base44.asServiceRole.entities.PodcastApplication.create({
      name: str(b.name, 120, true), email, phone: str(b.phone, 40), smierc: b.smierc, story, today,
      forma: b.forma, social: str(b.social, 300), consent_adult: true, consent_art9: true, consent_at: now,
      status: "nowe", pilne, historia: [{ status: "nowe", at: now }],
    });

    waitUntil((async () => {
      const admin = await adminTo(base44);
      const smtp = base44;
      const link = `${APP}/admin/kontakty`;
      if (pilne) {
        await sendMail(smtp, { to: email, subject: "Dziękuję za Twoją wiadomość", html: wrap(`<p>Dziękuję za tę wiadomość. Przeczytam Twoje zgłoszenie osobiście.</p><p>Jeśli jest Ci teraz bardzo ciężko, nie czekaj na moją odpowiedź. Zadzwoń teraz:</p>${HELP}<p>Twoja historia poczeka. Ty jesteś ważniejszy(-a).</p><p>Dawid, exmortis</p>`) }).catch(() => {});
        await sendMail(smtp, { to: admin, subject: "SPRAWDŹ PILNIE — zgłoszenie do podcastu", html: wrap(`<p>Nowe zgłoszenie zawiera słowa wskazujące na kryzys.</p><p><a style="color:#C9A24A" href="${link}">Otwórz panel</a></p>`) }).catch(() => {});
      } else {
        await sendMail(smtp, { to: email, subject: "Twoje zgłoszenie do podcastu exmortis", html: wrap(`<p>Dziękuję. Przeczytam Twoją historię uważnie. Odpowiem w ciągu 14 dni.</p><p>Dawid, exmortis</p>`) }).catch(() => {});
        await sendMail(smtp, { to: admin, subject: "Nowe zgłoszenie do podcastu", html: wrap(`<p>Przyszło nowe zgłoszenie gościa.</p><p><a style="color:#C9A24A" href="${link}">Otwórz panel</a></p>`) }).catch(() => {});
      }
    })());

    return Response.json({ ok: true, id: rec.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}