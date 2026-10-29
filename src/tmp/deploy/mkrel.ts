// Buduje eszip z nazwami modułów DOKŁADNIE takimi, jak ścieżki w paczce Supabase:
// „index.ts" oraz „_shared/....ts" (bez prefiksu file:///). Katalog roboczy: /tmp/fnprep/<slug>.
// Użycie: deno run --allow-all src/tmp/deploy/mkrel.ts <slug> <katalog-wyjściowy>
const [slug, outDir] = Deno.args;
if (!slug) throw new Error("Podaj nazwę funkcji");

const prep = `/tmp/fnprep/${slug}`;
const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");

const read = async (specifier) => {
  const rel = String(specifier).replace(/^\.\//, "").replace(/^\/+/, "");
  const content = await Deno.readTextFile(`${prep}/${rel}`).catch(() => null);
  return content === null ? undefined : { kind: "module", specifier: rel, content };
};

const bytes = await build(["index.ts"], async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  return await read(specifier);
});

await Deno.mkdir(outDir, { recursive: true });
await Deno.writeFile(`${outDir}/${slug}.eszip`, bytes);
console.log(`eszip ${slug}: ${bytes.length} B (moduły: index.ts, _shared/*)`);