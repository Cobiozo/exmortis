import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, emailField, textField } from "../../shared/supabase.ts";
import { getSetting, loadAppUrl, APP_URL as SITE_URL } from "../../shared/settings.ts";
import { sendMail } from "../../shared/smtp.ts";

// Publiczne przesłanie testu "Która śmierć jest Twoja?": zapis pełnego wyniku,
// opcjonalny zapis na Listy powrotu, e-mail z wynikiem (SMTP z panelu admina).

const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];

// Kolejność stwierdzeń przemieszana — indeksy każdej kategorii w tablicy odpowiedzi.
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

function resultText(dominant, isF) {
  if (dominant === "Mentalna") {
    return "Praca, która kiedyś Cię budowała, dziś zabiera Ci siebie po cichu. To nie lenistwo i nie „gorszy okres”. Największa pułapka tego miejsca brzmi: „muszę się bardziej postarać”. Nie musisz bardziej. Musisz się zatrzymać i zapytać, po co to wszystko robisz.";
  }
  if (dominant === "Duchowa") {
    return isF
      ? "Sens, na którym stałaś, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem, że jesteś gotowa na sens głębszy niż ten, który miałaś. Sensu się nie znajduje. Sens się buduje."
      : "Sens, na którym stałeś, przestał wystarczać. Twoja pustka nie jest niewdzięcznością — jest sygnałem, że jesteś gotowy na sens głębszy niż ten, który miałeś. Sensu się nie znajduje. Sens się buduje.";
  }
  if (dominant === "Życiowa") {
    return isF
      ? "Jedno wydarzenie rozebrało to, co znałaś. Nie masz opóźnienia — świat ma zbyt krótką pamięć. Nie chodzi o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił."
      : "Jedno wydarzenie rozebrało to, co znałeś. Nie masz opóźnienia — świat ma zbyt krótką pamięć. Nie chodzi o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił.";
  }
  return "Tak jest u większości ludzi, którzy do mnie przychodzą. Jedna śmierć uruchamia drugą, druga maskuje trzecią. Dlatego warto zacząć od mapy całej drogi, a nie od jednego fragmentu.";
}

function stageText(stage, isF) {
  if (stage === "Śmierć") return "Jesteś na początku drogi. Tu nie trzeba jeszcze nic zmieniać — trzeba zobaczyć i nazwać.";
  if (stage === "Próg") return "Wiesz już, co umarło. Teraz liczy się jedna rzecz: decyzja, nie deklaracja.";
  if (stage === "Powrót") return "Budujesz coś nowego. To najdłuższy etap — i ten, w którym najłatwiej wrócić do starego.";
  return isF
    ? "Wróciłaś. Teraz zadanie na całe życie: nie wrócić do śmierci."
    : "Wróciłeś. Teraz zadanie na całe życie: nie wrócić do śmierci.";
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

function resultEmailHtml({ name, dominantText, stage, sText, recommended }) {
  const links = recommended
    .map(
      (p) =>
        `<p style="margin:8px 0;"><a href="${SITE_URL}/produkt/${p.slug}" style="color:#C9A24A;text-decoration:none;">${p.name}</a></p>`
    )
    .join("");
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <p style="color:#8A8A8C;">${name},</p>
    <p style="line-height:1.7;color:#E2E2E2;">${dominantText}</p>
    <p style="color:#C9A24A;margin-top:24px;">Twój etap: ${stage}</p>
    <p style="line-height:1.7;color:#E2E2E2;">${sText}</p>
    <p style="color:#C9A24A;margin-top:24px;">Od czego zacząć</p>
    ${links}
    <p style="line-height:1.7;color:#E2E2E2;margin-top:24px;">Jeśli czujesz, że to Twój moment — porozmawiajmy. Trzydzieści minut, bezpłatnie, bez zobowiązań:
    <a href="${SITE_URL}/powrot" style="color:#C9A24A;">umów rozmowę kwalifikacyjną</a>.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">Dawid — exmortis. Wracam z siebie. Uczę wracać.</p>
    <p style="color:#3D3D3F;font-size:11px;">Ten test nie jest diagnozą i nie zastępuje pomocy specjalisty. Jeśli jesteś w kryzysie, zadzwoń pod bezpłatny numer 116 123 albo 112.</p>
  </div>`;
}

export default async function (req) {
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
    if (
      !Array.isArray(answers) ||
      answers.length !== 12 ||
      answers.some((a) => ![0, 1, 2, 3].includes(Number(a)))
    ) {
      throw new Error("Niepoprawne odpowiedzi testu");
    }

    const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
    const scores = {
      mentalna: sum(IDX_MENTAL),
      duchowa: sum(IDX_SPIRITUAL),
      zyciowa: sum(IDX_LIFE),
    };

    const ranked = [
      ["Mentalna", scores.mentalna],
      ["Duchowa", scores.duchowa],
      ["Życiowa", scores.zyciowa],
    ].sort((a, b) => b[1] - a[1]);
    let dominant = ranked[0][0];
    if (ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";

    await runSql(
      base44,
      `INSERT INTO public.quiz_result (email, first_name, form_of_address, score_mental, score_spiritual, score_life, dominant, stage, open_answer, newsletter_consent, source)
       VALUES (${escStr(email)}, ${escStr(firstName)}, ${escStr(formOfAddress)}, ${scores.mentalna}, ${scores.duchowa}, ${scores.zyciowa}, ${escStr(dominant)}, ${escStr(stage)}, ${
        openAnswer === null ? "NULL" : escStr(openAnswer)
      }, ${body.newsletter_consent === true}, ${source === null ? "NULL" : escStr(source)})`
    );

    if (body.newsletter_consent === true) {
      await runSql(
        base44,
        `INSERT INTO public.subscribers (id, email, name)
         VALUES (gen_random_uuid()::text, ${escStr(email)}, ${escStr(firstName)})
         ON CONFLICT (email) DO NOTHING`
      );
    }

    const productRows = await runSql(
      base44,
      `SELECT slug, name, status FROM public.products WHERE active = true`,
      true
    );
    const recommended = recommendProducts(productRows, stage, dominant);

    let emailSent = false;
    try {
      const smtp = await getSetting(base44, "smtp");
      await sendMail(smtp, {
        to: email,
        subject: `Twój wynik: ${dominant} · etap ${stage}`,
        html: resultEmailHtml({
          name: firstName,
          dominantText: resultText(dominant, isF),
          stage,
          sText: stageText(stage, isF),
          recommended,
        }),
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }

    return Response.json({ dominant, scores, recommended, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}