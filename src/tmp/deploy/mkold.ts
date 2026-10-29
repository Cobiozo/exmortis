// Buduje eszip w formacie ESZIP2 (starsza wersja biblioteki) — taki format ma paczka,
// którą platforma przyjęła (shopWaitlist). Moduły: wirtualny korzeń file:///index.ts + _shared.
// Użycie: deno run --allow-all src/tmp/deploy/mkold.ts <slug> <katalog-wyjściowy>
const [slug, outDir] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const prep = `/tmp/fnprep/${slug}`;
const { build } = await import("https://deno.land/x/eszip@v0.20.0/mod.ts");

const read = async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  const rel = String(specifier).replace(/^file:\/\/\//, "").replace(/^\.\//, "").replace(/^\/+/, "");
  const content = await Deno.readTextFile(`${prep}/${rel}`).catch(() => null);
  return content === null ? undefined : { kind: "module", specifier, content };
};

const bytes = await build(["file:///index.ts"], read);

await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B`);