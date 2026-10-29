// Buduje PŁASKI pakiet eszip jednej funkcji Supabase: index.ts + _shared/ w jednym katalogu.
// Dzięki temu w paczce jest tylko jeden moduł wejściowy (index.ts), bez starych, zagnieżdżonych ścieżek.
// Importy „../_shared/..." w kopii roboczej stają się „./_shared/..." — pliki w repozytorium zostają nietknięte.
// Użycie: deno run --allow-all src/tmp/deploy/mkflat.ts <slug> <katalog-wyjściowy>
const [slug, outDir] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const SRC = "/app/supabase/functions";
const prep = `/tmp/fnprep/${slug}`;

await Deno.remove(prep, { recursive: true }).catch(() => {});
await Deno.mkdir(prep, { recursive: true });

const idx = await Deno.readTextFile(`${SRC}/${slug}/index.ts`);
await Deno.writeTextFile(`${prep}/index.ts`, idx.replace(/\.\.\/_shared\//g, "./_shared/"));

async function copyDir(from: string, to: string) {
  await Deno.mkdir(to, { recursive: true });
  for await (const e of Deno.readDir(from)) {
    const f = `${from}/${e.name}`;
    const t = `${to}/${e.name}`;
    if (e.isDirectory) await copyDir(f, t);
    else await Deno.copyFile(f, t);
  }
}
await copyDir(`${SRC}/_shared`, `${prep}/_shared`);

const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");
const { load } = await import("https://deno.land/x/eszip@v0.55.2/loader.ts");

const bytes = await build([`file://${prep}/index.ts`], async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  return await load(specifier);
});

await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B (płaski: index.ts + _shared)`);