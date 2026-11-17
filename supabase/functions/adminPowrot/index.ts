import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, rpc, esc, escStr, textField, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail } from "../_shared/smtp.ts";
import { emailButton } from "../_shared/emailLayout.ts";
import { ensureSurveyColumns, newSurveyToken, SURVEY_DAYS, surveyLink, firstName, wrap, escHtml } from "../_shared/powrotSurvey.ts";
import { ensurePayColumns, PAY_DAYS, PAY_MIN, PAY_MAX, payLink } from "../_shared/powrotPay.ts";
import { docAttachment, regulaminAttachment, docLatest } from "../_shared/legalDocs.ts";
import { randomToken, sha256hex } from "../_shared/booking.ts";

// Panel „Kandydaci i uczestnicy POWRÓT” (v2, 18.11.2026): statusy z historią (tylko dopisywaną), notatki,
// czas obsługi, wiadomości z podglądem, zaproszenie na rozmowę wstępną (pakiet 1 × 20 min + jednorazowy link),
// notatki z sesji i wiadomości uczestnika. Wyłącznie administrator.
// Odpowiedzi z części o zdrowiu nie wchodzą do listy — tylko po akcji „health”, z wpisem w historii.

const FIELDS = `id, created_date, full_name, email, phone, age, return_from, return_from_other, situation,
  duration, affected_areas, tried_before, goal, obstacle, readiness, weekly_time, work_form,
  investment, anything_else, source, contact_pref, consent_rodo, consent_paid, consent_health, pilne,
  survey_sent_at, survey_expires_at, survey_done_at, wspolpraca_od, wspolpraca_do,
  pay_amount, pay_sent_at, pay_expires_at, paid_at,
  status, status_at, last_contact_at, czas_min, notatka, oczekiwania, start_kiedy, decyzja,
  invite_sent_at, invite_expires_at, invite_package_id,
  (therapy_support IS NOT NULL OR zdrowie_uwagi IS NOT NULL) AS has_health`;

const STATUSES = ["nowe", "ankieta_wyslana", "ankieta_wypelniona", "zaproszony", "rozmowa_zaplanowana", "rozmowa_odbyta",
  "oferta", "w_programie", "wstrzymany", "zakonczony", "lista_oczekujacych", "odroczone", "inna_forma", "zamkniete"];
// Szablony wiadomości: tekst przygotowuje panel (podgląd i edycja), serwer ustala tylko skutek dla statusu.
const TEMPLATE_STATUS: Record<string, string | null> = {
  info: null, odroczenie: "odroczone", inna_forma: "inna_forma", lista: "lista_oczekujacych",
  nieobecnosc: null, powitanie: "w_programie", zakonczenie: "zakonczony", wiadomosc: null,
};
const INVITE_DAYS = 7;
const NOTE_ETAPY = ["smierc", "prog", "powrot", "inny"];

const idOf = (body) => textField(body, "id", { max: 64 });
const paragraphs = (text: string) =>
  String(text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

async function getApp(base44, id: string) {
  const r = await runSql(base44, `SELECT ${FIELDS} FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
  return r && r[0] ? r[0] : null;
}

async function log(base44, appId: string, kind: string, summary: string, actor: string, from: string | null = null, to: string | null = null) {
  await runSql(base44, `INSERT INTO public.powrot_log (application_id, kind, from_status, to_status, summary, actor)
    VALUES (${esc(appId)}, ${escStr(kind)}, ${from ? escStr(from) : "NULL"}, ${to ? escStr(to) : "NULL"}, ${escStr(String(summary).slice(0, 500))}, ${escStr(actor)})`).catch(() => {});
}

// Zmiana statusu z wpisem w historii; przy przyjęciu i zakończeniu uzupełnia daty współpracy (retencja).
async function setStatus(base44, app, to: string, actor: string, summary = "") {
  if (!STATUSES.includes(to)) throw new Error("Nieznany status.");
  if (app.status === to) return;
  const extra = to === "w_programie" ? ", wspolpraca_od = COALESCE(wspolpraca_od, current_date), wspolpraca_do = NULL"
    : to === "zakonczony" ? ", wspolpraca_do = current_date" : "";
  await runSql(base44, `UPDATE public.powrot_applications SET status = ${escStr(to)}, status_at = now(), updated_date = now()${extra}
    WHERE id = ${esc(app.id)}`);
  await log(base44, app.id, "status", summary || "Zmiana statusu", actor, app.status || null, to);
}

// Synchronizacja z kalendarzem i płatnością przy otwarciu panelu (bez zmian w funkcjach rezerwacji i PayU).
async function syncStatuses(base44) {
  const moved = await runSql(base44, `UPDATE public.powrot_applications a SET status = 'rozmowa_zaplanowana', status_at = now(), last_contact_at = now()
    FROM public.bk_bookings k WHERE k.package_id = a.invite_package_id AND k.status = 'POTWIERDZONA' AND a.status = 'zaproszony'
    RETURNING a.id`).catch(() => []);
  for (const r of moved || []) await log(base44, r.id, "status", "Kandydat wybrał termin rozmowy wstępnej", "system", "zaproszony", "rozmowa_zaplanowana");
  const done = await runSql(base44, `UPDATE public.powrot_applications a SET status = 'rozmowa_odbyta', status_at = now()
    FROM public.bk_bookings k WHERE k.package_id = a.invite_package_id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')
      AND k.ends_at < now() AND a.status = 'rozmowa_zaplanowana'
    RETURNING a.id`).catch(() => []);
  for (const r of done || []) await log(base44, r.id, "status", "Termin rozmowy wstępnej minął — oznaczona jako odbyta (do zmiany ręcznie, jeśli się nie odbyła)", "system", "rozmowa_zaplanowana", "rozmowa_odbyta");
  const paid = await runSql(base44, `UPDATE public.powrot_applications SET status = 'w_programie', status_at = now(),
      wspolpraca_od = COALESCE(wspolpraca_od, current_date)
    WHERE paid_at IS NOT NULL AND COALESCE(status, 'nowe') IN ('nowe','ankieta_wyslana','ankieta_wypelniona','zaproszony','rozmowa_zaplanowana','rozmowa_odbyta','oferta')
    RETURNING id`).catch(() => []);
  for (const r of paid || []) await log(base44, r.id, "status", "Płatność potwierdzona — przyjęty do programu", "system", null, "w_programie");
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const actor = String(admin?.email || "admin");
    const body = await req.json().catch(() => ({}));
    await ensureSurveyColumns(base44);
    await ensurePayColumns(base44);
    const a = body.action;

    // Usunięcie zgłoszenia: ten wiersz i powiązane notatki, historia i wiadomości (kaskadowo).
    // Konto, newsletter, zapisy na spotkania i inne dane osoby zostają nietknięte.
    if (a === "delete") {
      const id = idOf(body);
      const found = await runSql(base44, `SELECT id, full_name, email FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
      const app = found && found[0];
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      const removed = await runSql(base44, `DELETE FROM public.powrot_applications WHERE id = ${esc(id)} RETURNING id`);
      if (!removed || !removed[0]) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      await base44.asServiceRole.entities.DataAccessLog.create({
        kto: admin.email, akcja: "usuniecie", zakres: "POWRÓT: zgłoszenie usunięte w panelu",
        osoba: `${app.full_name} <${app.email}>`, liczba: 1, at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({ ok: true });
    }

    // Szczegóły jednej osoby: historia, notatki z sesji, wiadomości, rozmowa wstępna.
    if (a === "detail") {
      const id = idOf(body);
      const app = await getApp(base44, id);
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      const [logRows, notes, msgs, booking] = await Promise.all([
        runSql(base44, `SELECT at, kind, from_status, to_status, summary, actor FROM public.powrot_log WHERE application_id = ${esc(id)} ORDER BY at DESC LIMIT 200`, true),
        runSql(base44, `SELECT id, nr, data, etap, notatka, krok, materialy, created_at, updated_at FROM public.powrot_session_notes WHERE application_id = ${esc(id)} ORDER BY nr, created_at`, true),
        runSql(base44, `SELECT id, kierunek, tresc, created_at, read_at FROM public.powrot_messages WHERE application_id = ${esc(id)} ORDER BY created_at DESC LIMIT 200`, true),
        app.invite_package_id
          ? runSql(base44, `SELECT starts_at, ends_at, status FROM public.bk_bookings WHERE package_id = ${escStr(app.invite_package_id)}::uuid ORDER BY created_at DESC LIMIT 1`, true)
          : Promise.resolve([]),
      ]);
      return Response.json({ app, log: logRows || [], notes: notes || [], messages: msgs || [], booking: booking?.[0] || null });
    }

    // Część B ankiety (zdrowie) — tylko na żądanie, z wpisem „dostęp” w historii.
    if (a === "health") {
      const id = idOf(body);
      const r = await runSql(base44, `SELECT therapy_support, zdrowie_uwagi, consent_health, consent_health_at FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
      if (!r || !r[0]) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      await log(base44, id, "dostep", "Wyświetlono część ankiety o zdrowiu", actor);
      return Response.json(r[0]);
    }

    if (a === "status") {
      const app = await getApp(base44, idOf(body));
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      await setStatus(base44, app, String(body.status || ""), actor, textField(body, "summary", { max: 300, required: false }) || "Zmiana statusu w panelu");
      return Response.json({ ok: true });
    }

    if (a === "note") {
      const id = idOf(body);
      const notatka = textField(body, "notatka", { max: 5000, required: false });
      await runSql(base44, `UPDATE public.powrot_applications SET notatka = ${esc(notatka)}, updated_date = now() WHERE id = ${esc(id)}`);
      await log(base44, id, "notatka", "Notatka administracyjna zaktualizowana", actor);
      return Response.json({ ok: true });
    }

    if (a === "time") {
      const id = idOf(body);
      const min = Math.round(Number(body.minutes));
      if (!Number.isFinite(min) || min === 0 || Math.abs(min) > 600) return Response.json({ error: "Podaj liczbę minut (1–600)." }, { status: 400 });
      await runSql(base44, `UPDATE public.powrot_applications SET czas_min = GREATEST(0, czas_min + ${min}), updated_date = now() WHERE id = ${esc(id)}`);
      await log(base44, id, "czas", `${min > 0 ? "+" : ""}${min} min obsługi`, actor);
      return Response.json({ ok: true });
    }

    // Wiadomość z szablonu (tekst z podglądu w panelu). Wysyłka wyłącznie po kliknięciu „Wyślij”.
    if (a === "mail") {
      const app = await getApp(base44, idOf(body));
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      const tpl = String(body.template || "");
      if (!(tpl in TEMPLATE_STATUS)) return Response.json({ error: "Nieznany szablon." }, { status: 400 });
      const subject = textField(body, "subject", { max: 200 });
      const text = textField(body, "body", { max: 8000 });
      await loadAppUrl(base44).catch(() => {});
      const mail = await sendMail(base44, { kind: "powrot", ref: app.id, to: app.email, subject, html: wrap(paragraphs(text)) });
      await runSql(base44, `UPDATE public.powrot_applications SET last_contact_at = now(), updated_date = now() WHERE id = ${esc(app.id)}`);
      await log(base44, app.id, "wiadomosc", `Wysłano: ${subject}`, actor);
      const to = TEMPLATE_STATUS[tpl];
      if (to) await setStatus(base44, app, to, actor, `Status po wiadomości „${subject}”`);
      return Response.json({ ok: true, mail });
    }

    if (a === "survey") {
      const app = await getApp(base44, idOf(body));
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      if (app.survey_done_at) return Response.json({ error: "Ankieta jest już wypełniona." }, { status: 400 });
      // Nowy token unieważnia poprzedni link (kolumna jest nadpisywana).
      const token = newSurveyToken();
      const updated = await runSql(base44,
        `UPDATE public.powrot_applications SET
           survey_token = ${escStr(token)}, survey_sent_at = now(),
           survey_expires_at = now() + interval '${SURVEY_DAYS} days', survey_reminded_at = NULL,
           survey_done_at = NULL, last_contact_at = now(), updated_date = now()
         WHERE id = ${esc(app.id)}
         RETURNING survey_sent_at, survey_expires_at`);
      await loadAppUrl(base44).catch(() => {});
      const link = surveyLink(APP, token);
      const mail = await sendMail(base44, {
        kind: "powrot_ankieta", ref: app.id, to: app.email,
        subject: "Ankieta przed rozmową — program POWRÓT",
        html: wrap(
          `<p>${escHtml(firstName(app.full_name))}, dziękuję za zgłoszenie do programu POWRÓT.</p>
           <p>Przeczytałem je i chcę lepiej zrozumieć Twoją sytuację i oczekiwania. Proszę o wypełnienie szczegółowej ankiety — zajmie około 8–10 minut.</p>
           <p>Pytania o zdrowie są w osobnej, nieobowiązkowej części. Możesz je pominąć bez wpływu na rozpatrzenie zgłoszenia.</p>
           <p style="margin:28px 0">${emailButton("Wypełnij ankietę", link)}</p>
           <p>Link jest osobisty i ważny ${SURVEY_DAYS} dni. Ankieta nie zobowiązuje Cię do zakupu.</p>
           <p>Dawid<br>EXMORTIS</p>`),
      });
      await log(base44, app.id, "wiadomosc", "Wysłano link do ankiety", actor);
      await setStatus(base44, app, "ankieta_wyslana", actor, "Link do ankiety wysłany");
      return Response.json({ ok: true, mail, survey_sent_at: updated?.[0]?.survey_sent_at ?? null, survey_expires_at: updated?.[0]?.survey_expires_at ?? null });
    }

    // Zaproszenie na rozmowę wstępną: pakiet 1 × „rozmowa-kwalifikacyjna” ważny 7 dni + jednorazowy link do kalendarza.
    if (a === "invite") {
      const app = await getApp(base44, idOf(body));
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      const [t] = await runSql(base44, `SELECT id, active, access, zoom_link FROM public.bk_types WHERE slug = 'rozmowa-kwalifikacyjna'`, true) || [];
      if (!t || !t.active) return Response.json({ error: "Rodzaj „Rozmowa wstępna POWRÓT” jest wyłączony w kalendarzu." }, { status: 400 });
      if (!t.zoom_link) return Response.json({ error: "Ustaw link Zoom dla rozmowy wstępnej w ustawieniach kalendarza — bez niego nie wyślę zaproszenia." }, { status: 400 });
      const token = randomToken();
      const r = await rpc(base44, "bk_grant_package", { p: {
        order_id: `powrot-wstepna:${app.id}:${Date.now()}`, type_id: t.id, sessions: 1, valid_days: INVITE_DAYS,
        email: String(app.email).toLowerCase(), token_hash: await sha256hex(token),
      } });
      if (!r?.ok || !r.id) return Response.json({ error: "Nie udało się utworzyć zaproszenia w kalendarzu." }, { status: 500 });
      await runSql(base44, `UPDATE public.powrot_applications SET invite_package_id = ${escStr(r.id)}::uuid, invite_sent_at = now(),
        invite_expires_at = now() + interval '${INVITE_DAYS} days', last_contact_at = now(), updated_date = now() WHERE id = ${esc(app.id)}`);
      await loadAppUrl(base44).catch(() => {});
      const link = `${APP}/rezerwacja/termin#t=${token}`;
      const intro = textField(body, "body", { max: 4000, required: false });
      const mail = await sendMail(base44, {
        kind: "powrot", ref: app.id, to: app.email,
        subject: "Zaproszenie na rozmowę wstępną — program POWRÓT",
        html: wrap(
          (intro ? paragraphs(intro) : `<p>${escHtml(firstName(app.full_name))}, dziękuję za Twoje zgłoszenie i odpowiedzi w ankiecie.</p>
           <p>Chcę zaprosić Cię na krótką rozmowę, podczas której sprawdzimy, czy program POWRÓT jest dla Ciebie odpowiednią drogą współpracy.</p>
           <p>Rozmowa trwa około 20 minut, odbywa się online i jest bezpłatna. Nie jest sesją mentoringową ani terapią.</p>`)
          + `<p style="margin:28px 0">${emailButton("Wybierz termin", link)}</p>
           <p>Link jest osobisty i ważny ${INVITE_DAYS} dni. Po wyborze terminu dostaniesz potwierdzenie z linkiem do spotkania i możliwością zmiany terminu.</p>
           <p>Dawid<br>EXMORTIS</p>`),
      });
      await log(base44, app.id, "wiadomosc", "Wysłano zaproszenie na rozmowę wstępną", actor);
      await setStatus(base44, app, "zaproszony", actor, "Zaproszenie na rozmowę wstępną wysłane");
      return Response.json({ ok: true, mail });
    }

    // Link do płatności: osobisty, ważny PAY_DAYS dni; nowy link unieważnia poprzedni.
    if (a === "pay") {
      const id = idOf(body);
      const amount = Math.round(Number(body.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount < PAY_MIN || amount > PAY_MAX) {
        return Response.json({ error: `Kwota musi być między ${PAY_MIN} a ${PAY_MAX} zł.` }, { status: 400 });
      }
      const app = await getApp(base44, id);
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      if (app.paid_at) return Response.json({ error: "Program jest już opłacony." }, { status: 400 });
      const umowa = await docAttachment(base44, "umowa_powrot", "Umowa-POWROT-exmortis");
      const ver = await docLatest(base44, "umowa_powrot");
      if (!umowa || !ver) return Response.json({ error: "Najpierw zapisz Umowę POWRÓT: Ustawienia → Dokumenty prawne → Zapisz." }, { status: 400 });
      const reg = await regulaminAttachment(base44);
      const token = newSurveyToken();
      const updated = await runSql(base44,
        `UPDATE public.powrot_applications SET
           pay_token = ${escStr(token)}, pay_amount = ${amount}, pay_sent_at = now(),
           pay_expires_at = now() + interval '${PAY_DAYS} days', last_contact_at = now(), updated_date = now()
         WHERE id = ${esc(id)}
         RETURNING pay_sent_at, pay_expires_at`);
      await loadAppUrl(base44).catch(() => {});
      const link = payLink(APP, token);
      const kwota = amount.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      const mail = await sendMail(base44, {
        kind: "powrot_platnosc", ref: app.id, to: app.email,
        subject: "Program POWRÓT — umowa i link do płatności",
        attachments: [umowa, ...(reg ? [reg] : [])],
        html: wrap(
          `<p>${escHtml(firstName(app.full_name))}, dziękuję za rozmowę. Cieszę się, że chcesz przejść POWRÓT.</p>
           <p>W załączniku jest Umowa o udział w programie POWRÓT (wersja ${escHtml(ver.version)}) i Regulamin. Przeczytaj je spokojnie przed płatnością — opisują zakres programu, terminy, zasady kontaktu, prawo odstąpienia i zwroty.</p>
           <p>Cena programu: <strong>${escHtml(kwota)} zł</strong>. Płatność przez PayU — także w ratach albo odroczona, jeśli operator udostępni taką formę dla Twojej płatności. O przyznaniu i warunkach rat decyduje instytucja finansująca.</p>
           <p style="margin:28px 0">${emailButton("Przejdź do płatności", link)}</p>
           <p style="font-size:13px;color:#8A8A8C">Link jest osobisty i ważny ${PAY_DAYS} dni. Termin pierwszej sesji ustalimy po zawarciu umowy.</p>
           <p>Dawid<br>EXMORTIS</p>`),
      });
      await log(base44, app.id, "wiadomosc", `Wysłano umowę i link do płatności (${kwota} zł)`, actor);
      await setStatus(base44, app, "oferta", actor, "Oferta wysłana");
      return Response.json({ ok: true, mail, pay_amount: amount, pay_sent_at: updated?.[0]?.pay_sent_at ?? null, pay_expires_at: updated?.[0]?.pay_expires_at ?? null });
    }

    // Notatki z sesji (wyłącznie mentor). Retencja: razem ze zgłoszeniem, 12 miesięcy po zakończeniu współpracy.
    if (a === "session_note") {
      const id = idOf(body);
      const n = body.note || {};
      const nr = Math.round(Number(n.nr));
      if (!Number.isFinite(nr) || nr < 0 || nr > 20) return Response.json({ error: "Numer sesji 0–20." }, { status: 400 });
      const etap = NOTE_ETAPY.includes(String(n.etap || "")) ? String(n.etap) : null;
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(n.data || "")) ? String(n.data) : null;
      const clip = (v, max) => (v == null || String(v).trim() === "" ? null : String(v).slice(0, max));
      const vals = `${nr}, ${data ? escStr(data) + "::date" : "NULL"}, ${etap ? escStr(etap) : "NULL"}, ${esc(clip(n.notatka, 10000))}, ${esc(clip(n.krok, 2000))}, ${esc(clip(n.materialy, 2000))}`;
      if (n.id && /^[0-9a-f-]{36}$/i.test(String(n.id))) {
        await runSql(base44, `UPDATE public.powrot_session_notes SET nr = ${nr}, data = ${data ? escStr(data) + "::date" : "NULL"},
          etap = ${etap ? escStr(etap) : "NULL"}, notatka = ${esc(clip(n.notatka, 10000))}, krok = ${esc(clip(n.krok, 2000))},
          materialy = ${esc(clip(n.materialy, 2000))}, updated_at = now()
          WHERE id = ${escStr(n.id)}::uuid AND application_id = ${esc(id)}`);
      } else {
        await runSql(base44, `INSERT INTO public.powrot_session_notes (application_id, nr, data, etap, notatka, krok, materialy)
          VALUES (${esc(id)}, ${vals})`);
      }
      await log(base44, id, "notatka", `Notatka z sesji ${nr} zapisana`, actor);
      return Response.json({ ok: true });
    }

    if (a === "session_note_delete") {
      const id = idOf(body);
      const nid = String(body.note_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(nid)) return Response.json({ error: "Brak notatki." }, { status: 400 });
      await runSql(base44, `DELETE FROM public.powrot_session_notes WHERE id = ${escStr(nid)}::uuid AND application_id = ${esc(id)}`);
      await log(base44, id, "notatka", "Notatka z sesji usunięta", actor);
      return Response.json({ ok: true });
    }

    // Odpowiedź mentora w „Moim koncie” uczestnika + krótkie powiadomienie e-mail bez treści.
    if (a === "msg_reply") {
      const app = await getApp(base44, idOf(body));
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      const tresc = textField(body, "tresc", { max: 4000 });
      await runSql(base44, `INSERT INTO public.powrot_messages (application_id, kierunek, tresc) VALUES (${esc(app.id)}, 'mentor', ${esc(tresc)})`);
      await runSql(base44, `UPDATE public.powrot_messages SET read_at = now() WHERE application_id = ${esc(app.id)} AND kierunek = 'uczestnik' AND read_at IS NULL`);
      await loadAppUrl(base44).catch(() => {});
      await sendMail(base44, {
        kind: "powrot", ref: app.id, to: app.email, subject: "Nowa wiadomość od Dawida — program POWRÓT",
        html: wrap(`<p>${escHtml(firstName(app.full_name))}, w Twoim koncie czeka nowa wiadomość ode mnie.</p><p style="margin:28px 0">${emailButton("Otwórz Mój POWRÓT", `${APP}/konto/powrot`)}</p><p>Dawid<br>EXMORTIS</p>`),
      }).catch(() => {});
      await log(base44, app.id, "wiadomosc", "Odpowiedź w Moim koncie", actor);
      return Response.json({ ok: true });
    }

    if (a === "msg_read") {
      const id = idOf(body);
      await runSql(base44, `UPDATE public.powrot_messages SET read_at = now() WHERE application_id = ${esc(id)} AND kierunek = 'uczestnik' AND read_at IS NULL`);
      return Response.json({ ok: true });
    }

    // Lista + proste wskaźniki lejka (bez danych wrażliwych).
    await syncStatuses(base44);
    const rows = await runSql(base44,
      `SELECT ${FIELDS},
         (SELECT count(*) FROM public.powrot_messages m WHERE m.application_id = a.id AND m.kierunek = 'uczestnik' AND m.read_at IS NULL)::int AS unread
       FROM public.powrot_applications a
       ORDER BY pilne DESC NULLS LAST, created_date DESC LIMIT 300`, true);
    const stats = await runSql(base44, `SELECT
        count(*)::int AS zgloszenia,
        count(survey_sent_at)::int AS ankiety_wyslane,
        count(survey_done_at)::int AS ankiety_wypelnione,
        count(invite_sent_at)::int AS zaproszenia,
        count(*) FILTER (WHERE status IN ('rozmowa_odbyta','oferta','w_programie','wstrzymany','zakonczony'))::int AS rozmowy_odbyte,
        count(pay_sent_at)::int AS oferty,
        count(paid_at)::int AS przyjeci,
        count(*) FILTER (WHERE status IN ('odroczone','inna_forma','zamkniete','lista_oczekujacych'))::int AS odroczenia,
        COALESCE(sum(czas_min), 0)::int AS czas_min,
        COALESCE(sum(pay_amount) FILTER (WHERE paid_at IS NOT NULL), 0)::float8 AS przychod,
        count(*) FILTER (WHERE status IN ('w_programie','wstrzymany'))::int AS aktywni
      FROM public.powrot_applications`, true);
    return Response.json({ applications: Array.isArray(rows) ? rows : [], stats: stats?.[0] || null });
  } catch (error) {
    const msg = String(error?.message || error);
    return Response.json({ error: msg === "FORBIDDEN" ? "Brak dostępu" : msg }, { status: msg === "FORBIDDEN" ? 403 : 400 });
  }
};

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
