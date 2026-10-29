// Buduje PŁASKI eszip: moduły nazwane „index.ts" i „_shared/*.ts" (bez ścieżek absolutnych),
// czyli dokładnie tak, jakiego układu oczekuje Supabase (entrypoint: index.ts → source/index.ts).
// Korzysta z katalogu przygotowanego przez mkflat.ts (/tmp/fnprep/<slug>).
// Użycie: deno run --allow-all src/tmp/deploy/mkzipflat.ts <slug> <katalog-wyjściowy>
const [slug, outDir] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const prep = `/tmp/fnprep/${slug}`;
const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");

const bytes = await build(["file:///index.ts"], async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  // Wirtualna, płaska ścieżka → plik w katalogu roboczym funkcji.
  const rel = specifier.replace(/^file:\/\//, "");
  const content = await Deno.readTextFile(`${prep}${rel}`).catch(() => null);
  return content === null ? undefined : { kind: "module", specifier, content };
});

await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B (płaski: index.ts + _shared)`);