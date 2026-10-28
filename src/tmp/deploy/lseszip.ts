const { Parser } = await import("https://deno.land/x/eszip@v0.55.2/mod.ts");
const file = await Deno.open(Deno.args[0], { read: true });
const parser = await Parser.createInstance();
const { modules, npmSpecifiers } = await parser.parse(file as any);
console.log(JSON.stringify({ modules: modules.slice(0, 8), count: modules.length, npmSpecifiers }));