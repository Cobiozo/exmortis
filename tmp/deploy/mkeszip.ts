// Buduje pojedynczą funkcję Supabase do formatu eszip (tak jak CLI), zachowując zależności npm.
// Użycie: deno run --allow-all tmp/deploy/mkeszip.ts <nazwa-funkcji> <plik-wyjsciowy>
const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");

const name = Deno.args[0];
const out = Deno.args[1];
const entry = new URL(`file:///app/supabase/functions/${name}/index.ts`);

const res = await build([entry.href]);
const eszip = res.eszip;
const bytes = await eszip.toBytes();
await Deno.writeFile(out, bytes);
console.log(`eszip ${name}: ${bytes.length} B`);