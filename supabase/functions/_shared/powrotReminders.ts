// POWRÓT — automatyczne przypomnienia (18.11.2026, decyzja właściciela).
// 1) Kandydat: jedno przypomnienie o niewypełnionej ankiecie, 5 dni po wysłaniu linku (gdy link jest jeszcze ważny).
// 2) Właściciel: jedno zbiorcze przypomnienie o zgłoszeniach, które czekają na decyzję dłużej niż 48 godzin
//    (obietnica odpowiedzi do 72 godzin). Ponownie dopiero po kolejnej zmianie statusu.
// Wywołuje cronTick raz na godzinę, tylko w godzinach 8–20 czasu polskiego.
import { runSql, escStr } from "./supabase.ts";
import { sendMail, adminTo } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { emailButton } from "./emailLayout.ts";
import { surveyLink, firstName, wrap, escHtml } from "./powrotSurvey.ts";
import { progSummaryReminder } from "./prog.ts";

const SURVEY_REMIND_DAYS = 5;
const ADMIN_REMIND_HOURS = 48;
const WAITING = ["nowe", "ankieta_wypelniona", "rozmowa_odbyta"];
const LABEL: Record<string, string> = {
  nowe: "Nowe zgłoszenie — odpowiedź do 72 godzin",
  ankieta_wypelniona: "Ankieta wypełniona — decyzja o zaproszeniu",
  rozmowa_odbyta: "Rozmowa odbyta — decyzja po rozmowie",
};

const dataPl = (v: unknown) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long" }).format(new Date(String(v)));
const godzPl = (v: unknown) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(String(v)));

async function log(base44, id: string, kind: string, summary: string) {
  await runSql(base44, `INSERT INTO public.powrot_log (application_id, kind, summary, actor)
    VALUES (${escStr(id)}, ${escStr(kind)}, ${escStr(summary)}, 'system')`).catch(() => {});
}

export async function surveyReminders(base44, limit = 10) {
  const rows = await runSql(base44, `SELECT id, full_name, email, survey_token, survey_expires_at
    FROM public.powrot_applications
    WHERE status = 'ankieta_wyslana' AND survey_done_at IS NULL AND survey_reminded_at IS NULL
      AND survey_token IS NOT NULL AND email IS NOT NULL
      AND survey_sent_at < now() - interval '${SURVEY_REMIND_DAYS} days'
      AND survey_expires_at > now() + interval '1 day'
    ORDER BY survey_sent_at LIMIT ${Number(limit) || 10}`, true);
  if (!rows.length) return 0;
  const url = await loadAppUrl(base44);
  let n = 0;
  for (const a of rows) {
    // Najpierw oznaczamy — nikt nie dostanie przypomnienia dwa razy, nawet przy błędzie wysyłki.
    const took = await runSql(base44, `UPDATE public.powrot_applications SET survey_reminded_at = now()
      WHERE id = ${escStr(a.id)} AND survey_reminded_at IS NULL RETURNING id`);
    if (!took.length) continue;
    const imie = firstName(a.full_name);
    await sendMail(base44, {
      kind: "powrot_ankieta_przypomnienie", ref: a.id, to: a.email,
      subject: "Przypomnienie: ankieta przed rozmową — program POWRÓT",
      html: wrap(
        `<p>${imie ? `${escHtml(imie)}, k` : "K"}ilka dni temu wysłałem Ci link do ankiety w programie POWRÓT.</p>
         <p>Jeśli nadal chcesz, żebym rozpatrzył Twoje zgłoszenie, wypełnij ją do ${escHtml(dataPl(a.survey_expires_at))}. Zajmie około 8–10 minut.</p>
         <p style="margin:28px 0">${emailButton("Wypełnij ankietę", surveyLink(url, a.survey_token))}</p>
         <p>Jeśli to nie jest dobry moment, nie musisz nic robić. To jedyne przypomnienie.</p>
         <p>Dawid<br>EXMORTIS</p>`),
    }).then(() => { n++; }).catch((e) => console.error("POWRÓT przypomnienie o ankiecie:", String(e?.message || e).slice(0, 200)));
    await log(base44, a.id, "wiadomosc", "Automatyczne przypomnienie o ankiecie (po 5 dniach)");
  }
  return n;
}

export async function adminWaitingReminder(base44) {
  const rows = await runSql(base44, `SELECT id, full_name, status, status_at, pilne
    FROM public.powrot_applications
    WHERE status IN (${WAITING.map((s) => escStr(s)).join(", ")})
      AND status_at < now() - interval '${ADMIN_REMIND_HOURS} hours'
      AND (admin_reminded_at IS NULL OR admin_reminded_at < status_at)
    ORDER BY pilne DESC NULLS LAST, status_at LIMIT 30`, true);
  if (!rows.length) return 0;
  const to = await adminTo(base44);
  if (!to) return 0;
  const ids = rows.map((r) => escStr(r.id)).join(", ");
  const took = await runSql(base44, `UPDATE public.powrot_applications SET admin_reminded_at = now()
    WHERE id IN (${ids}) AND (admin_reminded_at IS NULL OR admin_reminded_at < status_at) RETURNING id`);
  const ok = new Set(took.map((r) => String(r.id)));
  const list = rows.filter((r) => ok.has(String(r.id)));
  if (!list.length) return 0;
  const url = await loadAppUrl(base44);
  const li = list.map((r) =>
    `<li style="margin-bottom:8px;">${r.pilne ? "<strong>PILNE</strong> · " : ""}${escHtml(r.full_name || "(bez imienia)")} — ${escHtml(LABEL[r.status] || r.status)}, od ${escHtml(godzPl(r.status_at))}</li>`).join("");
  await sendMail(base44, {
    kind: "powrot_admin_przypomnienie", to,
    subject: `POWRÓT: ${list.length === 1 ? "zgłoszenie czeka" : "zgłoszenia czekają"} na decyzję ponad 48 godzin (${list.length})`,
    html: wrap(
      `<p>Te zgłoszenia czekają na Twoją decyzję dłużej niż 48 godzin. Na stronie obiecujesz odpowiedź do 72 godzin.</p>
       <ul style="line-height:1.6;">${li}</ul>
       <p style="margin:28px 0">${emailButton("Otwórz panel POWRÓT", `${url}/admin/powrot`)}</p>
       <p style="font-size:13px;color:#8A8A8C">Przypomnienie przychodzi raz dla danego etapu. Treść zgłoszeń jest tylko w panelu.</p>`),
  });
  for (const r of list) await log(base44, r.id, "system", "Przypomnienie dla prowadzącego: zgłoszenie czeka ponad 48 godzin");
  return list.length;
}

export async function powrotReminders(base44) {
  const ankiety = await surveyReminders(base44).catch((e) => { console.error("POWRÓT ankiety:", String(e?.message || e).slice(0, 200)); return 0; });
  const prowadzacy = await adminWaitingReminder(base44).catch((e) => { console.error("POWRÓT 48 h:", String(e?.message || e).slice(0, 200)); return 0; });
  // Rozmowa na progu (osobna usługa): podsumowanie nieudostępnione 24 h po spotkaniu.
  const podsumowania = await progSummaryReminder(base44).catch((e) => { console.error("Rozmowa na progu, podsumowania:", String(e?.message || e).slice(0, 200)); return 0; });
  return { ankiety, prowadzacy, podsumowania };
}
