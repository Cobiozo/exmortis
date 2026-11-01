// Buduje eszip w układzie zgodnym z aktualnie wdrożoną funkcją Supabase:
// moduły „source/<slug>/index.ts" i „source/_shared/*.ts", a korzeń paczki to file:///source/<slug>/index.ts.
// Dzięki temu metadane (entrypoint_path) zostają nietknięte — wymieniamy wyłącznie ciało funkcji.
// Użycie: deno run --allow-all src/tmp/deploy/mksrc.ts <slug> <katalog-wyjściowy> [plik-index]
const [slug, outDir, idxOverride] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const SRC = "/app/supabase/functions";
const entryFile = idxOverride || `${SRC}/${slug}/index.ts`;
const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");

// file:///source/eventsPublic/index.ts  → /app/supabase/functions/eventsPublic/index.ts
// file:///source/_shared/supabase.ts     → /app/supabase/functions/_shared/supabase.ts
const toPath = (specifier) => {
  const rel = String(specifier).replace(/^file:\/\/\/source\//, "");
  if (!rel || rel === specifier.replace(/^file:\/\//, "")) return null;
  const parts = rel.split("/");
  const file = parts.pop();
  if (parts[0] === slug && !idxOverride) return null; // korzeń podajemy z entryFile (może być inna kopia)
  return `${SRC}/${parts.length ? `${parts.join("/")}/` : ""}${file}`;
};

const read = async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  const rootSpec = `file:///source/${slug}/index.ts`;
  const rel = String(specifier).replace(/^file:\/\/\/source\//, "");
  if (specifier === rootSpec) {
    const content = await Deno.readTextFile(entryFile);
    return { kind: "module", specifier, content };
  }
  const p = `${SRC}/${rel}`;
  const content = await Deno.readTextFile(p).catch(() => null);
  return content === null ? undefined : { kind: "module", specifier, content };
};

const bytes = await build([`file:///source/${slug}/index.ts`], read);
await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B → ${outDir}/${slug}.eszip`);