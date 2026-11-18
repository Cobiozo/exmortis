import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Inbox } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNoIndex } from "@/lib/useNoIndex";
import Container from "@/components/exmortis/ui/Container";
import Section from "@/components/exmortis/ui/Section";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import BrandCard from "@/components/exmortis/ui/BrandCard";
import ProductHighlight from "@/components/exmortis/ui/ProductHighlight";
import PaperCard from "@/components/exmortis/ui/PaperCard";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";

// Podgląd systemu wizualnego (/admin/styl) — tylko dla administratora, nic nie zapisuje.
// Pokazuje tokeny, typografię, przyciski we wszystkich stanach, karty i stany pomocnicze.
const COLORS = [
  ["Tło strony", "--exm-bg", "#0A0A0B"],
  ["Powierzchnia", "--exm-surface", "#111113"],
  ["Powierzchnia 2", "--exm-surface-2", "#161618"],
  ["Linia", "--exm-line", "rgba(255,255,255,.10)"],
  ["Linia mocna", "--exm-line-strong", "rgba(255,255,255,.16)"],
  ["Złoto", "--exm-gold", "#C9A24A"],
  ["Złoto hover", "--exm-gold-hover", "#E2C27A"],
  ["Linia złota", "--exm-gold-line", "rgba(201,162,74,.35)"],
  ["Bordo", "--exm-bordo", "#5C1A1B"],
  ["Kość słoniowa", "--exm-ivory", "#F5EFE1"],
  ["Tekst", "--exm-text", "#E2E2E2"],
  ["Tekst pomocniczy", "--exm-text-muted", "rgba(226,226,226,.72)"],
  ["Błąd", "--exm-error", "#E24449"],
];

function Block({ title, note, children }) {
  return (
    <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:p-7">
      <p className="exm-eyebrow mb-1">{title}</p>
      {note && <p className="mb-5 text-sm text-exm-muted">{note}</p>}
      <div className={note ? "" : "mt-5"}>{children}</div>
    </div>
  );
}

export default function AdminStyle() {
  useNoIndex();
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-exm-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-exm-line border-t-exm-gold" />
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-5 text-center">
        <ShieldAlert className="h-12 w-12 text-exm-error" />
        <p className="exm-h2">Nie masz dostępu</p>
        <p className="max-w-sm text-exm-muted">Ta strona jest dostępna tylko dla administratora.</p>
        <Link to="/" className="btn-relic">Strona główna</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-exm-bg pb-24">
      <Section className="!pb-0">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-exm-line pb-8">
            <div>
              <p className="exm-eyebrow mb-3">System wizualny · etap 1</p>
              <h1 className="exm-h1">Podgląd</h1>
              <p className="exm-lead mt-4 max-w-[60ch]">
                Kolory, typografia, przyciski, karty i stany pomocnicze w jednym miejscu. Strona niczego nie zapisuje.
              </p>
            </div>
            <BrandButton to="/admin" variant="secondary">Wróć do panelu</BrandButton>
          </div>
        </Container>
      </Section>

      <Section className="!pt-14 md:!pt-16">
        <Container className="grid gap-6 lg:grid-cols-2">
          {/* Kolory */}
          <Block title="Kolory" note="Tokeny --exm-* w :root (src/index.css).">
            <ul className="grid gap-2 sm:grid-cols-2">
              {COLORS.map(([name, token, value]) => (
                <li key={token} className="flex items-center gap-3 rounded-[var(--exm-r-field)] border border-exm-line p-2">
                  <span className="h-9 w-9 shrink-0 rounded-[6px] border border-exm-line-strong" style={{ background: value }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-exm-text">{name}</span>
                    <span className="technical block text-[9px] text-exm-muted">{token}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Block>

          {/* Typografia */}
          <Block title="Typografia" note="EB Garamond (nagłówki) · Inter (tekst) · Space Mono (etykiety) · Cinzel (napis EXMORTIS).">
            <div className="space-y-5">
              <div>
                <p className="exm-eyebrow mb-2">Etykieta · exm-eyebrow</p>
                <p className="exm-h1">Wracam z siebie</p>
                <p className="exm-h2 mt-3">Nagłówek H2</p>
                <p className="exm-h3 mt-2">Nagłówek H3</p>
                <p className="exm-lead mt-4">Lead: jedno zdanie wprowadzające pod tytułem sekcji.</p>
                <p className="mt-4 text-[var(--exm-body)] leading-[var(--exm-body-lh)] text-exm-text">
                  Tekst podstawowy. Wysokość wiersza 1,65 — wygodna przy dłuższym czytaniu na telefonie i na komputerze.
                </p>
              </div>
              <p className="exm-wordmark text-2xl text-exm-gold">EXMORTIS</p>
            </div>
          </Block>

          {/* Przyciski */}
          <Block title="Przyciski" note="Warianty i stany: zwykły, hover (najedź), fokus (Tab), wyłączony, ładowanie.">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <BrandButton>Główny</BrandButton>
                <BrandButton variant="secondary">Drugorzędny</BrandButton>
                <BrandButton variant="link">Link tekstowy</BrandButton>
                <button type="button" className="btn-blood">Bordowy</button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <BrandButton disabled>Wyłączony</BrandButton>
                <BrandButton variant="secondary" disabled>Wyłączony</BrandButton>
                <BrandButton loading>Ładowanie</BrandButton>
                <BrandButton variant="secondary" loading>Ładowanie</BrandButton>
              </div>
              <p className="text-sm text-exm-muted">
                Przycisk w ładowaniu ma ustawione <span className="technical text-[10px]">aria-busy</span> i nie zmienia szerokości.
              </p>
            </div>
          </Block>

          {/* Formularz */}
          <Block title="Formularz" note="Pola, etykiety, podpowiedź i komunikat błędu. Nic nie wysyła.">
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label htmlFor="styl-imie" className="mb-2 block text-sm text-exm-ivory">Imię</label>
                <input id="styl-imie" name="imie" placeholder="Jak mam się do Ciebie zwracać" className="hairline min-h-[48px] w-full border bg-transparent px-3 text-exm-text" />
              </div>
              <div>
                <label htmlFor="styl-email" className="mb-2 block text-sm text-exm-ivory">Adres e-mail</label>
                <input id="styl-email" name="email" type="email" placeholder="twoj@adres.pl" className="hairline min-h-[48px] w-full border bg-transparent px-3 text-exm-text" />
                <p className="mt-2 text-sm text-exm-muted">Na ten adres przyjdzie potwierdzenie.</p>
              </div>
              <div>
                <label htmlFor="styl-opis" className="mb-2 block text-sm text-exm-ivory">Kilka słów</label>
                <textarea id="styl-opis" name="opis" rows={3} placeholder="Możesz napisać tyle, ile chcesz." className="hairline w-full border bg-transparent px-3 py-2 text-exm-text" />
              </div>
              <div className="flex items-center gap-3">
                <input id="styl-zgoda" type="checkbox" className="h-4 w-4 accent-[#C9A24A]" />
                <label htmlFor="styl-zgoda" className="text-sm text-exm-text">Zgadzam się na kontakt w tej sprawie.</label>
              </div>
              <div>
                <input aria-invalid="true" placeholder="Pole z błędem" className="min-h-[48px] w-full border bg-transparent px-3 text-exm-text" style={{ borderColor: "var(--exm-error)" }} />
                <p className="mt-2 text-sm" style={{ color: "var(--exm-error)" }}>Podaj poprawny adres e-mail.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <BrandButton type="submit">Wyślij</BrandButton>
                <BrandButton variant="secondary" type="reset">Wyczyść</BrandButton>
              </div>
            </form>
          </Block>
        </Container>
      </Section>

      {/* SectionHeader */}
      <Section tone="surface">
        <Container className="space-y-14">
          <div>
            <p className="exm-eyebrow mb-5">SectionHeader · do lewej</p>
            <SectionHeader
              eyebrow="Powrót"
              title="Wracam z siebie. Uczę wracać."
              lead="Mentoring 1:1 dla osób, które chcą wrócić do siebie po trudnym czasie."
              action={<BrandButton variant="link" to="/powrot">Poznaj Powrót</BrandButton>}
            />
          </div>
          <div>
            <p className="exm-eyebrow mb-5">SectionHeader · do środka</p>
            <SectionHeader
              align="center"
              eyebrow="Skarbiec"
              title="Materiały na drogę"
              lead="Ebooki, nagrania i spotkania — w swoim czasie i tempie."
            />
          </div>
        </Container>
      </Section>

      {/* Karty */}
      <Section>
        <Container>
          <SectionHeader eyebrow="BrandCard" title="Warianty kart" lead="Media o stałych proporcjach, akcja zawsze przy dolnej krawędzi, jednakowa wysokość w rzędzie." />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <BrandCard
              variant="produkt"
              media={<ImageFallback className="absolute inset-0" label="Okładka produktu" />}
              highlight={<ProductHighlight kind="nowosc" />}
              label="Ebook"
              title="Kiedy ktoś bliski gaśnie"
              description="O tym, co robić, gdy bliska osoba traci chęć do życia."
              meta="PDF · 120 stron"
              action={<BrandButton to="/skarbiec">Zobacz</BrandButton>}
            />
            <BrandCard
              variant="usługa"
              media={<ImageFallback className="absolute inset-0" label="Zdjęcie usługi" />}
              highlight={<ProductHighlight kind="promocja" />}
              label="Mentoring"
              title="Powrót 1:1"
              description="Dwanaście tygodni pracy w Twoim tempie, z rozmową na żywo."
              meta="12 tygodni · 6 rozmów"
              action={<BrandButton to="/powrot">Poznaj</BrandButton>}
            />
            <BrandCard
              variant="wydarzenie"
              media={<ImageFallback className="absolute inset-0" label="Grafika spotkania" />}
              highlight={<ProductHighlight kind="rabat" label="−20%" />}
              label="Spotkanie"
              title="Wieczór pytań"
              description="Otwarte spotkanie online, bez zapisów i bez zobowiązań."
              meta="20 listopada · 20:00"
              action={<BrandButton variant="secondary" to="/spotkania">Zapisz się</BrandButton>}
            />
            <BrandCard
              variant="treść"
              media={<ImageFallback className="absolute inset-0" label="Grafika tekstu" />}
              label="Tekst"
              title="Trzy śmierci, o których nie mówimy"
              description="Krótki tekst o tym, co w nas umiera wcześniej niż ciało."
              action={<BrandButton variant="link" to="/o-mnie">Czytaj</BrandButton>}
            />
            <BrandCard
              variant="krok"
              step="01"
              label="Krok"
              title="Nazwij to, co się stało"
              description="Pierwszy krok to zgoda na to, że coś się skończyło."
            />
            <BrandCard
              variant="produkt"
              featured
              media={<ImageFallback className="absolute inset-0" label="Okładka wyróżniona" />}
              highlight={<ProductHighlight kind="nowosc" />}
              label="Wyróżniony"
              title="Karta pozioma"
              description="Ten sam układ, ułożony poziomo — na pierwszy plan w rzędzie."
              meta="Wariant featured"
              action={<BrandButton to="/skarbiec">Zobacz</BrandButton>}
            />
          </div>
        </Container>
      </Section>

      {/* Znaczki, papier, stany */}
      <Section tone="surface">
        <Container className="grid gap-6 lg:grid-cols-2">
          <Block title="ProductHighlight" note="Najwyżej jeden znaczek na kartę, w lewym górnym rogu okładki.">
            <div className="flex flex-wrap items-center gap-3">
              <ProductHighlight kind="nowosc" />
              <ProductHighlight kind="promocja" />
              <ProductHighlight kind="rabat" />
              <ProductHighlight kind="rabat" label="−30%" />
            </div>
          </Block>

          <Block title="PaperCard" note="Jasna karta papieru — okładka książki i podsumowanie zamówienia.">
            <PaperCard>
              <p className="exm-eyebrow mb-3" style={{ color: "#8A6A1F" }}>Podsumowanie</p>
              <p className="text-lg">Ebook „Kiedy ktoś bliski gaśnie”</p>
              <p className="mt-1 text-sm" style={{ opacity: 0.75 }}>Dostęp od razu po zakupie, plik PDF.</p>
              <p className="mt-5 text-2xl" style={{ fontFamily: "var(--exm-font-serif)" }}>79 zł</p>
            </PaperCard>
          </Block>

          <Block title="EmptyState" note="Pusta lista: ikona, tytuł, jedno zdanie i akcja.">
            <EmptyState
              icon={<Inbox />}
              title="Nie ma jeszcze wiadomości"
              description="Gdy pojawi się nowa, zobaczysz ją tutaj."
              action={<BrandButton variant="secondary" to="/kontakt">Napisz do mnie</BrandButton>}
            />
          </Block>

          <Block title="SkeletonBlock" note="Wymiary docelowej treści — nic nie skacze po wczytaniu.">
            <div className="space-y-3">
              <SkeletonBlock className="h-[160px]" rounded="var(--exm-r-card)" />
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-4 w-1/2" />
            </div>
          </Block>

          <Block title="ImageFallback" note="Brak zdjęcia: ciemna tekstura z sygnetem EXMORTIS.">
            <div className="grid grid-cols-2 gap-4">
              <ImageFallback className="aspect-[3/4] rounded-[var(--exm-r-card)]" label="Brak okładki 3:4" />
              <ImageFallback className="aspect-[16/9] rounded-[var(--exm-r-card)]" label="Brak zdjęcia 16:9" />
            </div>
          </Block>
        </Container>
      </Section>
    </div>
  );
}