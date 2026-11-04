import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, emailField, textField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";

const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
import { getSetting, loadAppUrl, APP_URL as SITE_URL } from "../_shared/settings.ts";
import { sendMail } from "../_shared/smtp.ts";

// Publiczne przesłanie testu „Która śmierć jest Twoja?”: zapis wyniku, opcjonalny zapis na Listy powrotu,
// e-mail z wynikiem. Wersja 2 (15 stwierdzeń, 5 na obszar, ostatnie 4 tygodnie) liczy poziom w każdym
// z trzech obszarów i zwraca gotowe teksty — strona i e-mail mówią to samo. Wersja 1 (12 odpowiedzi)
// działa dalej dla otwartych wcześniej kart przeglądarki. To narzędzie do refleksji, nie diagnoza.

const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];
const CRISIS = "Jeśli jesteś w kryzysie albo myślisz o odebraniu sobie życia: 116 123 (bezpłatny telefon zaufania dla dorosłych), 800 70 2222 (Centrum Wsparcia, całą dobę), a w sytuacji zagrożenia życia 112.";
const NOT_DIAGNOSIS = "Ten test nie jest diagnozą i nie zastępuje rozmowy z lekarzem, psychologiem ani psychoterapeutą. To narzędzie do zatrzymania się i przyjrzenia sobie.";

import { V2, DIM_LABEL, LEVELS, levelOf, DIM_TEXT, DOMINANT, scoreV2, STAGE_TEXT } from "../_shared/quizScore.ts";
import { nextSteps } from "../_shared/quizNext.ts";

const P = (s, extra = "") => `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 14px;${extra}">${s}</p>`;
const GOLD = (s, extra = "") => `<p style="color:#C9A24A;margin:26px 0 10px;letter-spacing:2px;font-size:12px;${extra}">${s}</p>`;

function resultEmailHtml({ name, head, body, dims, questions, stage, sText, next, deep }) {
  const A = (href, label) => `<a href="${SITE_URL}${href}" style="color:#C9A24A;text-decoration:none;">${escHtml(label)}</a>`;
  const line = (html) => `<p style="margin:8px 0;line-height:1.6;color:#E2E2E2;">${html}</p>`;
  const n = next || { main: null, free: [], offer: null };
  const links = [
    n.main ? line(`Na początek: ${A(`/skarbiec/${n.main.slug}`, n.main.name)} — jeden list w każdy poniedziałek.`) : "",
    line(`Zajrzyj do ${A("/skarbiec", "Skarbca")} — materiały na każdy etap drogi.`),
    n.free.length ? line(`Bezpłatnie: ${n.free.map((p) => A(`/skarbiec/${p.slug}`, p.name)).join(" · ")}`) : "",
    line(`${A("/spotkania", "Spotkania")} — otwarte spotkania online i na żywo.`),
    n.offer ? line(`Jeśli chcesz pracować ze mną: ${A(`/skarbiec/${n.offer.slug}`, n.offer.name)}${n.offer.slug === "powrot-mentoring" ? ` — zacznij od bezpłatnej ${A("/powrot", "rozmowy kwalifikacyjnej")}.` : "."}`) : "",
  ].join("");
  const dimHtml = (dims || [])
    .map((d) => `<p style="margin:0 0 4px;color:#C9A24A;font-size:12px;letter-spacing:2px;">${d.label.toUpperCase()} · ${d.score}/${d.max} · ${d.level_label}</p>${P(d.text, "color:#B8B8BA;")}`)
    .join("");
  const qHtml = (questions || []).map((q) => P(`— ${q}`)).join("");
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    ${P(escHtml(head), "font-size:19px;color:#F5EFE1;")}
    ${P(body)}
    ${dims ? GOLD("TRZY OBSZARY") + dimHtml : ""}
    ${deep ? P(`Przynajmniej w jednym obszarze Twoje odpowiedzi są bardzo wysokie. Dobrze jest porozmawiać o tym z kimś zaufanym i ze specjalistą — lekarzem, psychologiem albo psychoterapeutą. ${CRISIS}`, "border-left:2px solid #5C1A1B;padding-left:12px;") : ""}
    ${questions ? GOLD("PYTANIA DO ZABRANIA ZE SOBĄ") + qHtml : ""}
    ${GOLD(`TWÓJ ETAP: ${stage.toUpperCase()}`)}
    ${P(sText)}
    ${GOLD("TWÓJ NASTĘPNY KROK")}${links}
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">Dawid — exmortis. Wracam z siebie. Uczę wracać.</p>
    <p style="color:#6A6A6C;font-size:11px;line-height:1.6;">${NOT_DIAGNOSIS} ${CRISIS}</p>
  </div>`;
}

// Kolumny wersji 2 dodawane raz na instancję (bez zmiany istniejących wierszy).
let migrated = false;
async function ensureColumns(base44) {
  if (migrated) return;
  await runSql(base44, `DO $q$
  DECLARE r record; t text;
  BEGIN
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS test_version smallint NOT NULL DEFAULT 1;
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS score_max smallint NOT NULL DEFAULT 12;
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS levels jsonb;
    -- Wcześniejsze ograniczenia dominanty i punktów (0–12) nie znają wyniku „Żadna” ani skali 0–15.
    FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.quiz_result'::regclass AND contype = 'c'
      AND conname <> 'quiz_result_v2_values' AND pg_get_constraintdef(oid) ~ '(dominant|score_)' LOOP
      EXECUTE format('ALTER TABLE public.quiz_result DROP CONSTRAINT %I', r.conname);
    END LOOP;
    SELECT CASE WHEN data_type = 'USER-DEFINED' THEN udt_schema || '.' || udt_name END INTO t
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quiz_result' AND column_name = 'dominant';
    IF t IS NOT NULL THEN EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', t, 'Żadna'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_result_v2_values') THEN
      ALTER TABLE public.quiz_result ADD CONSTRAINT quiz_result_v2_values CHECK (
        score_mental BETWEEN 0 AND 15 AND score_spiritual BETWEEN 0 AND 15 AND score_life BETWEEN 0 AND 15) NOT VALID;
    END IF;
  END $q$`);
  migrated = true;
}

// ---------- przepływ od 3.11.2026: wynik bez danych kontaktowych, wysyłka opcjonalna ----------
// action "wynik":  odpowiedzi + etap → wynik. Zapis anonimowy: same punkty, poziomy, etap i źródło
//                  (bez imienia, e-maila, formy zwracania się i osobistego zdania). Zwraca result_key.
//                  Ponowne „wynik” z tym samym result_key (zmiana odpowiedzi) nadpisuje ten sam wiersz.
// action "wyslij": result_key + e-mail + zgoda → mail z wynikiem (neutralny, bez imienia), opcjonalnie
//                  zapis na Listy (osobna zgoda) i osobiste zdanie (tylko przy zaznaczonej zgodzie).
let anonReady = false;
async function ensureAnon(base44) {
  if (anonReady) return;
  await ensureColumns(base44).catch((e) => console.error("quiz migrate:", e?.message));
  await runSql(base44, `DO $q$ BEGIN
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS result_key text;
    ALTER TABLE public.quiz_result ADD COLUMN IF NOT EXISTS anon boolean NOT NULL DEFAULT false;
    ALTER TABLE public.quiz_result ALTER COLUMN email DROP NOT NULL;
    ALTER TABLE public.quiz_result ALTER COLUMN first_name DROP NOT NULL;
    ALTER TABLE public.quiz_result ALTER COLUMN form_of_address DROP NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS quiz_result_key_uq ON public.quiz_result (result_key) WHERE result_key IS NOT NULL;
  END $q$`);
  anonReady = true;
}

const KEY_RE = /^[a-f0-9]{32}$/;
const newKey = () => crypto.randomUUID().replace(/-/g, "");

function buildResult(scores, stage, products) {
  // Te same reguły co scoreV2 (quizScore.ts), liczone z zapisanych sum — wynik w mailu = wynik na stronie.
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let dominant = DIM_LABEL[ranked[0][0]];
  if (ranked[0][1] < LEVELS[1].min) dominant = "Żadna";
  else if (ranked[1][1] >= LEVELS[1].min && ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
  const dims = Object.keys(scores).map((k) => {
    const l = levelOf(scores[k]);
    return { key: k, label: DIM_LABEL[k], score: scores[k], max: V2.max, level: l.key, level_label: l.label, text: DIM_TEXT[k][l.key] };
  });
  const deep = dims.some((d) => d.level === "gleboko");
  const d = DOMINANT[dominant] || DOMINANT.Mieszana;
  const ns = nextSteps(products || [], { dims, stage, dominant, deep });
  const nameOf = (slug) => (products || []).find((p) => p.slug === slug)?.name || slug;
  const next = {
    main: ns.main ? { slug: ns.main, name: nameOf(ns.main) } : null,
    free: ns.free.map((slug) => ({ slug, name: nameOf(slug) })),
    offer: ns.offer ? { slug: ns.offer, name: nameOf(ns.offer) } : null,
  };
  // „recommended” zostaje dla starszych kart przeglądarki: ta sama kolejność co na stronie.
  const recommended = [next.main, ...next.free, next.offer].filter(Boolean);
  return {
    version: 2, dominant, scores, dims, deep, recommended, next,
    headline: d.head(""), body: d.body, questions: d.questions,
    stage, stage_text: STAGE_TEXT[stage], not_diagnosis: NOT_DIAGNOSIS, crisis: CRISIS,
  };
}

async function handleWynik(req, base44, body) {
  const stage = body.stage;
  if (!STAGES.includes(stage)) return Response.json({ error: "Wybierz etap drogi" }, { status: 400 });
  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length !== V2.n || answers.some((a) => ![0, 1, 2, 3].includes(Number(a)))) {
    return Response.json({ error: "Niepoprawne odpowiedzi testu" }, { status: 400 });
  }
  if (!(await ipAllowed(base44, clientIp(req), "test_wynik", 40, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
  const r2 = scoreV2(answers);
  const source = textField(body, "source", { max: 50, required: false });
  const productRows = await runSql(base44, `SELECT slug, name, status, price FROM public.products WHERE active = true`, true).catch(() => []);
  const out = buildResult(r2.scores, stage, productRows);

  // Zapis anonimowy nie blokuje wyniku — przy błędzie bazy wynik i tak się pokaże.
  let key = typeof body.result_key === "string" && KEY_RE.test(body.result_key) ? body.result_key : null;
  try {
    await ensureAnon(base44);
    const levels = escStr(JSON.stringify(Object.fromEntries(out.dims.map((d) => [d.key, d.level])))) + "::jsonb";
    const sc = r2.scores;
    if (key) {
      const ex = await runSql(base44, `SELECT 1 FROM public.quiz_result WHERE result_key = ${escStr(key)} AND email IS NULL`, true).catch(() => []);
      if (ex?.length) {
        await runSql(base44, `UPDATE public.quiz_result SET score_mental = ${sc.mentalna}, score_spiritual = ${sc.duchowa}, score_life = ${sc.zyciowa},
          dominant = ${escStr(out.dominant)}, stage = ${escStr(stage)}, levels = ${levels} WHERE result_key = ${escStr(key)} AND email IS NULL`);
      } else key = null;
    }
    if (!key) {
      key = newKey();
      await runSql(base44, `INSERT INTO public.quiz_result (result_key, anon, score_mental, score_spiritual, score_life, dominant, stage, newsletter_consent, source, test_version, score_max, levels)
        VALUES (${escStr(key)}, true, ${sc.mentalna}, ${sc.duchowa}, ${sc.zyciowa}, ${escStr(out.dominant)}, ${escStr(stage)}, false, ${source === null ? "NULL" : escStr(source)}, 2, ${V2.max}, ${levels})`);
    }
  } catch (e) {
    console.error("quiz anon:", e?.message);
  }
  return Response.json({ ...out, result_key: key });
}

async function handleWyslij(req, base44, body) {
  const key = typeof body.result_key === "string" && KEY_RE.test(body.result_key) ? body.result_key : null;
  if (!key) return Response.json({ error: "Najpierw zobacz wynik testu" }, { status: 400 });
  if (body.consent !== true) return Response.json({ error: "Zaznacz zgodę na wysłanie wyniku" }, { status: 400 });
  const email = emailField(body);
  // Wynik idzie e-mailem na podany adres — limit chroni przed wysyłką na cudze adresy seriami.
  if (!(await ipAllowed(base44, clientIp(req), "test", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
  await ensureAnon(base44);
  const rows = await runSql(base44, `SELECT score_mental, score_spiritual, score_life, stage, email FROM public.quiz_result WHERE result_key = ${escStr(key)}`, true);
  const row = rows?.[0];
  if (!row) return Response.json({ error: "Nie znalazłem tego wyniku — zrób test jeszcze raz" }, { status: 404 });
  if (row.email && String(row.email).toLowerCase() !== email.toLowerCase()) {
    return Response.json({ error: "Ten wynik został już wysłany na inny adres" }, { status: 409 });
  }
  const scores = { mentalna: Number(row.score_mental), duchowa: Number(row.score_spiritual), zyciowa: Number(row.score_life) };
  const productRows = await runSql(base44, `SELECT slug, name, status, price FROM public.products WHERE active = true`, true).catch(() => []);
  const out = buildResult(scores, row.stage, productRows);
  // Osobiste zdanie: zapisywane wyłącznie przy zaznaczonej zgodzie (domyślnie nie).
  const open = body.share_open === true ? textField(body, "open_answer", { max: 2000, required: false }) : null;
  const news = body.newsletter_consent === true;
  await runSql(base44, `UPDATE public.quiz_result SET email = ${escStr(email)}, newsletter_consent = ${news}${open ? `, open_answer = ${escStr(open)}` : ""} WHERE result_key = ${escStr(key)}`);
  if (news) {
    await (await import("../_shared/newsletter.ts")).addSubscriber(base44, { email, name: "" }).catch(() => {});
  }
  const d = DOMINANT[out.dominant] || DOMINANT.Mieszana;
  const state = await sendMail(base44, {
    kind: "test_wynik",
    to: email,
    subject: `Twój wynik testu: ${out.dominant === "Żadna" ? "żadna śmierć nie dominuje" : out.dominant === "Mieszana" ? "więcej niż jedna śmierć" : `śmierć ${out.dominant.toLowerCase()}`} · etap ${row.stage}`,
    html: resultEmailHtml({ name: "", head: out.headline, body: out.body, dims: out.dims, questions: d.questions, stage: row.stage, sText: STAGE_TEXT[row.stage], next: out.next, deep: out.deep }),
  });
  return Response.json({ ok: true, delivery: state === "wyslany" ? "wyslany" : "kolejka" });
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));
    // Strona sprawdza, czy funkcja zna nowy przepływ (wynik bez e-maila) — do czasu wdrożenia działa stary.
    if (body.action === "ping") return Response.json({ ok: true, flow: 3 });
    if (body.action === "wynik") return await handleWynik(req, base44, body);
    if (body.action === "wyslij") return await handleWyslij(req, base44, body);
    // Dawny przepływ (imię i e-mail przed wynikiem) wyłączony 4.11.2026 — wynik liczy tylko action „wynik”.
    return Response.json({ error: "Odśwież stronę testu i spróbuj ponownie." }, { status: 400 });
  } catch (error) {
    const msg = String(error?.message || error);
    return Response.json({ error: msg }, { status: error?.isValidation ? 400 : 500 });
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