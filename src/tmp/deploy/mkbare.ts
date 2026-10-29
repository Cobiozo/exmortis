// Buduje eszip, w którym moduły mają CZYSTE ścieżki (index.ts, _shared/x.ts) — bez file:///.
// Korzeń to poprawny URL (inaczej biblioteka się wywraca), ale loader zwraca nazwę względną,
// więc importy „./_shared/..." trafiają do _shared/.
// Użycie: deno run --allow-all src/tmp/deploy/mkbare.ts <slug> <katalog-wyjściowy>
const [slug, outDir] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const prep = `/tmp/fnprep/${slug}`;
const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");

const toRel = (s) =>
  String(s)
    .replace(/^file:\/\/\/[^/]*\//, "")
    .replace(/^file:\/\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

const seen = new Set();
const read = async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  const rel = toRel(specifier);
  const key = `${specifier} -> ${rel}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const content = await Deno.readTextFile(`${prep}/${rel}`).catch(() => null);
  return content === null ? undefined : { kind: "module", specifier: rel, content };
};

const bytes = await build(["file:///index.ts"], read);

await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B`);