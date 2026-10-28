const { build } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");
const { load } = await import("https://deno.land/x/eszip@v0.55.2/loader.ts");
const [dir, out] = Deno.args;
const bytes = await build([`file://${dir}/index.ts`], async (specifier) => {
  if (/^(node|npm|jsr):/.test(specifier)) return { kind: "external", specifier };
  return await load(specifier);
});
await Deno.writeFile(out, bytes);
console.log(`eszip ${out}: ${bytes.length} B`);