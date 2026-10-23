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

// ---------- wersja 2 ----------
// Kolejność stwierdzeń na stronie: M, D, Ż, M, D, Ż… — indeksy każdego obszaru w tablicy odpowiedzi.
const V2 = { n: 15, max: 15, idx: { mentalna: [0, 3, 6, 9, 12], duchowa: [1, 4, 7, 10, 13], zyciowa: [2, 5, 8, 11, 14] } };
const DIM_LABEL = { mentalna: "Mentalna", duchowa: "Duchowa", zyciowa: "Życiowa" };
const LEVELS = [
  { key: "brak", label: "brak wyraźnych oznak", min: 0 },
  { key: "sygnaly", label: "pierwsze sygnały", min: 4 },
  { key: "wyraznie", label: "wyraźnie obecna", min: 8 },
  { key: "gleboko", label: "głęboko obecna", min: 12 },
];
const levelOf = (score) => [...LEVELS].reverse().find((l) => score >= l.min);

const DIM_TEXT = {
  mentalna: {
    brak: "W tym obszarze nie widać wyraźnych oznak. Masz dziś dostęp do energii i obecności — warto wiedzieć, co je podtrzymuje.",
    sygnaly: "Pojawiają się pierwsze sygnały: zmęczenie, które wraca, chwile działania na autopilocie. To jeszcze nie śmierć — to ostrzeżenie, które łatwo zagłuszyć kolejnym obowiązkiem.",
    wyraznie: "Zmęczenie i obojętność stały się tłem codzienności. Funkcjonujesz, ale coraz mniej w tym Ciebie. To miejsce, w którym najczęściej pada zdanie: „muszę się bardziej postarać”.",
    gleboko: "Odpowiedzi wskazują na głębokie wyczerpanie. Kiedy siły kończą się na tym poziomie, sama wola nie wystarczy — potrzebny jest odpoczynek, wsparcie bliskich i często rozmowa ze specjalistą.",
  },
  duchowa: {
    brak: "Sens i kierunek są dziś dla Ciebie dostępne. To zasób — warto go nazwać, zanim przyjdzie czas, w którym będzie potrzebny.",
    sygnaly: "Pojawiają się pytania o sens, które jeszcze nie bolą, ale nie dają spokoju. To często pierwszy znak, że dotychczasowe odpowiedzi robią się za ciasne.",
    wyraznie: "Sens, który dotąd niósł, przestał wystarczać. Masz to, co „powinno” dawać spełnienie — a w środku jest cisza. To nie niewdzięczność. To sygnał, że dawne odpowiedzi się wyczerpały.",
    gleboko: "Odpowiedzi wskazują na głęboką utratę sensu i kierunku. Pustka na tym poziomie bardzo obciąża — nie warto zostawać z nią w pojedynkę.",
  },
  zyciowa: {
    brak: "Nie widać śladów straty ani końca, który wciąż Cię zatrzymuje. Jeśli coś ważnego się skończyło, wygląda na to, że znalazło już swoje miejsce.",
    sygnaly: "Jest w Tobie coś, co się skończyło i wciąż daje o sobie znać. Wraca w pojedynczych chwilach, choć na co dzień sobie radzisz.",
    wyraznie: "Jedno wydarzenie podzieliło życie na „przed” i „po”. Otoczenie oczekuje, że to już za Tobą, a Ty wciąż jesteś w środku. To nie opóźnienie — żałoba ma własny czas.",
    gleboko: "Odpowiedzi wskazują, że strata wciąż zajmuje bardzo dużo miejsca i odbiera siły na codzienność. Przez to nie trzeba przechodzić w pojedynkę.",
  },
};

const DOMINANT = {
  Mentalna: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyraźniej widać śmierć mentalną.`,
    body: "Śmierć mentalna nie wygląda jak upadek. Wygląda jak sprawne działanie: obowiązki zrobione, terminy dotrzymane, a w środku coraz mniej obecności. Największa pułapka tego miejsca brzmi: „muszę się bardziej postarać”. Nie musisz bardziej. Najpierw trzeba się zatrzymać i zobaczyć, co naprawdę zabiera Ci siły — i po co to wszystko robisz.",
    questions: ["Co robisz dziś tylko dlatego, że „tak trzeba”?", "Kiedy ostatnio coś naprawdę Cię ożywiło — i co wtedy było inne?", "Co by się stało, gdyby przez tydzień nikt nie widział Twojego wysiłku?"],
  },
  Duchowa: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyraźniej widać śmierć duchową.`,
    body: "Śmierć duchowa przychodzi cicho. Z zewnątrz wszystko jest na miejscu, a w środku gaśnie światło, które dawało kierunek. Pustka nie jest niewdzięcznością ani słabością. Jest znakiem, że dawne odpowiedzi stały się za ciasne. Sensu nie znajduje się gotowego. Sens się buduje — od pytań, których dotąd nie było wolno zadać.",
    questions: ["Co straciło dla Ciebie znaczenie w ostatnich latach?", "Za czym tęsknisz, kiedy wokół robi się cicho?", "Gdyby nikt nie oceniał Twojego wyboru — jaki byłby następny krok?"],
  },
  Życiowa: {
    head: (n) => `${n}, w Twoich odpowiedziach najwyraźniej widać śmierć życiową.`,
    body: "Śmierć życiowa ma datę. Strata, rozstanie, koniec pracy, zdrowia albo roli, która była całym życiem. Świat ma krótką pamięć i szybko oczekuje powrotu do formy. Nie chodzi jednak o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił.",
    questions: ["Co skończyło się razem z tym wydarzeniem — poza tym, co widać?", "Czego nie pozwalasz sobie jeszcze opłakać?", "Co z tamtego życia chcesz zabrać dalej, a co zostawić?"],
  },
  Mieszana: {
    head: (n) => `${n}, niesiesz więcej niż jedną śmierć.`,
    body: "Tak jest u większości ludzi, którzy do mnie przychodzą. Jedna śmierć uruchamia drugą, druga maskuje trzecią: strata odbiera sens, brak sensu wyczerpuje, a wyczerpanie nie pozwala przeżyć straty. Dlatego warto zacząć nie od jednego fragmentu, ale od mapy całej drogi — i od pytania, która śmierć była pierwsza.",
    questions: ["Która z tych śmierci była pierwsza?", "Która z nich zabiera Ci dziś najwięcej sił?", "Gdyby można było zająć się dziś tylko jedną — która by to była?"],
  },
  Żadna: {
    head: (n) => `${n}, żadna z trzech śmierci nie dominuje.`,
    body: "Twoje odpowiedzi są niskie we wszystkich trzech obszarach. To może znaczyć, że jesteś dziś w dobrym miejscu — i warto wiedzieć, co Cię w nim trzyma. Może też znaczyć, że trudne rzeczy są dobrze schowane. Odpowiedz sobie uczciwie, co jest bliższe prawdy, i wróć do testu za kilka tygodni.",
    questions: ["Co dziś daje Ci siłę, sens i oparcie?", "O co dbasz, żeby tak zostało?", "Czy ktoś w Twoim otoczeniu przechodzi teraz swoją śmierć?"],
  },
};

function scoreV2(answers) {
  const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
  const scores = { mentalna: sum(V2.idx.mentalna), duchowa: sum(V2.idx.duchowa), zyciowa: sum(V2.idx.zyciowa) };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let dominant = DIM_LABEL[ranked[0][0]];
  if (ranked[0][1] < LEVELS[1].min) dominant = "Żadna";
  else if (ranked[1][1] >= LEVELS[1].min && ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
  const dims = Object.keys(scores).map((k) => {
    const l = levelOf(scores[k]);
    return { key: k, label: DIM_LABEL[k], score: scores[k], max: V2.max, level: l.key, level_label: l.label, text: DIM_TEXT[k][l.key] };
  });
  return { scores, dominant, dims, deep: dims.some((d) => d.level === "gleboko") };
}

const STAGE_TEXT = {
  "Śmierć": "Jesteś na początku drogi. Tu nie trzeba jeszcze niczego zmieniać — trzeba zobaczyć i nazwać, co się skończyło.",
  "Próg": "Wiesz już, co umarło. Teraz liczy się jedna rzecz: decyzja, nie deklaracja.",
  "Powrót": "Budujesz coś nowego. To najdłuższy etap — i ten, w którym najłatwiej wrócić do starego.",
  "Inny": "Najtrudniejsze masz za sobą. Teraz zadanie na długo: nie wrócić do tego, co Cię zabijało.",
};

// ---------- wersja 1 (12 odpowiedzi) — bez zmian ----------
const IDX_MENTAL = [0, 3, 6, 9];
const IDX_SPIRITUAL = [1, 4, 7, 10];
const IDX_LIFE = [2, 5, 8, 11];

// Rekomendacje produktów według etapu (tylko status "dostępny", brakujące uzupełniane po kolei).
const RECIPES = {
  "Śmierć": ["mini-ebook-trzy-smierci", "wracam-inny", "listy-powrotu"],
  "Próg": ["3-pierwsze-ruchy", "wracam-inny", "powrot-mentoring"],
  "Powrót": ["wracam-inny", "dziennik-powrotu-90-dni", "powrot-mentoring"],
  "Inny": ["listy-powrotu", "kanal-whatsapp", "wracam-inny"],
};

function resultTextV1(dominant, isF) {
  if (dominant === "Mentalna") return DOMINANT.Mentalna.body;
  if (dominant === "Duchowa") {
    return isF
      ? "Sens, na którym stałaś, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem, że jesteś gotowa na sens głębszy niż ten, który miałaś. Sensu się nie znajduje. Sens się buduje."
      : "Sens, który dotąd wystarczał, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem gotowości na sens głębszy niż dotychczasowy. Sensu się nie znajduje. Sens się buduje.";
  }
  if (dominant === "Życiowa") return DOMINANT["Życiowa"].body;
  return DOMINANT.Mieszana.body;
}

function recommendProducts(products, stage, dominant) {
  const available = products.filter((p) => p.status === "dostępny");
  const bySlug = new Map(available.map((p) => [p.slug, p]));
  const picks = (RECIPES[stage] || []).filter((slug) => bySlug.has(slug));
  if (dominant === "Mentalna" && bySlug.has("pusty-szczyt")) {
    picks[2] = "pusty-szczyt";
  }
  for (const p of available) {
    if (picks.length >= 3) break;
    if (!picks.includes(p.slug)) picks.push(p.slug);
  }
  return picks.slice(0, 3).map((slug) => ({ slug, name: bySlug.get(slug).name }));
}

const P = (s, extra = "") => `<p style="line-height:1.7;color:#E2E2E2;margin:0 0 14px;${extra}">${s}</p>`;
const GOLD = (s, extra = "") => `<p style="color:#C9A24A;margin:26px 0 10px;letter-spacing:2px;font-size:12px;${extra}">${s}</p>`;

function resultEmailHtml({ name, head, body, dims, questions, stage, sText, recommended, deep }) {
  const links = recommended
    .map((p) => `<p style="margin:8px 0;"><a href="${SITE_URL}/skarbiec/${p.slug}" style="color:#C9A24A;text-decoration:none;">${escHtml(p.name)}</a></p>`)
    .join("");
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
    ${links ? GOLD("OD CZEGO ZACZĄĆ") + links : ""}
    ${P(`Jeśli czujesz, że to Twój moment — porozmawiajmy. Trzydzieści minut, bezpłatnie, bez zobowiązań: <a href="${SITE_URL}/powrot" style="color:#C9A24A;">umów rozmowę kwalifikacyjną</a>.`, "margin-top:24px;")}
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

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));

    const email = emailField(body);
    const firstName = textField(body, "first_name", { max: 200, required: true });
    const formOfAddress = body.form_of_address;
    if (formOfAddress !== "Mężczyzna" && formOfAddress !== "Kobieta") {
      throw new Error("Brak formy zwracania się");
    }
    const stage = body.stage;
    if (!STAGES.includes(stage)) {
      throw new Error("Brak etapu drogi");
    }
    const openAnswer = textField(body, "open_answer", { max: 2000, required: false });
    const source = textField(body, "source", { max: 50, required: false });
    const isF = formOfAddress === "Kobieta";

    const answers = body.answers;
    const n = Array.isArray(answers) ? answers.length : 0;
    if ((n !== 12 && n !== V2.n) || answers.some((a) => ![0, 1, 2, 3].includes(Number(a)))) {
      return Response.json({ error: "Niepoprawne odpowiedzi testu" }, { status: 400 });
    }
    // Wynik idzie e-mailem na podany adres — limit chroni przed wysyłką na cudze adresy seriami.
    if (!(await ipAllowed(base44, clientIp(req), "test", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });

    const v2 = n === V2.n;
    let scores, dominant, r2 = null;
    if (v2) {
      r2 = scoreV2(answers);
      scores = r2.scores; dominant = r2.dominant;
    } else {
      const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
      scores = { mentalna: sum(IDX_MENTAL), duchowa: sum(IDX_SPIRITUAL), zyciowa: sum(IDX_LIFE) };
      const ranked = [["Mentalna", scores.mentalna], ["Duchowa", scores.duchowa], ["Życiowa", scores.zyciowa]].sort((a, b) => b[1] - a[1]);
      dominant = ranked[0][0];
      if (ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
    }

    // Zapis wyniku nie blokuje osoby — przy błędzie bazy wynik i tak się pokaże.
    try {
      await ensureColumns(base44).catch((e) => console.error("quiz migrate:", e?.message));
      const levels = r2 ? escStr(JSON.stringify(Object.fromEntries(r2.dims.map((d) => [d.key, d.level])))) + "::jsonb" : "NULL";
      await runSql(
        base44,
        `INSERT INTO public.quiz_result (email, first_name, form_of_address, score_mental, score_spiritual, score_life, dominant, stage, open_answer, newsletter_consent, source${migrated ? ", test_version, score_max, levels" : ""})
         VALUES (${escStr(email)}, ${escStr(firstName)}, ${escStr(formOfAddress)}, ${scores.mentalna}, ${scores.duchowa}, ${scores.zyciowa}, ${escStr(dominant)}, ${escStr(stage)}, ${
          openAnswer === null ? "NULL" : escStr(openAnswer)
        }, ${body.newsletter_consent === true}, ${source === null ? "NULL" : escStr(source)}${migrated ? `, ${v2 ? 2 : 1}, ${v2 ? V2.max : 12}, ${levels}` : ""})`
      );
    } catch (e) {
      console.error("quiz insert:", e?.message);
    }

    if (body.newsletter_consent === true) {
      await (await import("../_shared/newsletter.ts")).addSubscriber(base44, { email, name: firstName }).catch(() => {});
    }

    const productRows = await runSql(base44, `SELECT slug, name, status FROM public.products WHERE active = true`, true).catch(() => []);
    const recommended = recommendProducts(productRows || [], stage, dominant);

    const d = DOMINANT[dominant] || DOMINANT.Mieszana;
    const out = v2
      ? {
        version: 2, dominant, scores, dims: r2.dims, deep: r2.deep, recommended,
        headline: d.head(firstName), body: d.body, questions: d.questions,
        stage, stage_text: STAGE_TEXT[stage], not_diagnosis: NOT_DIAGNOSIS, crisis: CRISIS,
      }
      : { dominant, scores, recommended };

    let emailSent = false;
    try {
      const r = await sendMail(base44, {
        kind: "test_wynik",
        to: email,
        subject: v2 ? `Twój wynik testu: ${dominant === "Żadna" ? "żadna śmierć nie dominuje" : dominant === "Mieszana" ? "więcej niż jedna śmierć" : `śmierć ${dominant.toLowerCase()}`} · etap ${stage}` : `Twój wynik: ${dominant} · etap ${stage}`,
        html: resultEmailHtml(v2
          ? { name: firstName, head: out.headline, body: out.body, dims: r2.dims, questions: d.questions, stage, sText: STAGE_TEXT[stage], recommended, deep: r2.deep }
          : { name: firstName, head: `${firstName},`, body: resultTextV1(dominant, isF), dims: null, questions: null, stage, sText: STAGE_TEXT[stage], recommended, deep: false }),
      });
      emailSent = r === "wyslany";
    } catch {
      emailSent = false;
    }

    return Response.json({ ...out, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}


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