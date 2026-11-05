// Bundel modułu z podmienionymi zależnościami (baza, ustawienia, poczta, opcjonalnie realizacja).
import * as esbuild from "esbuild";
import path from "node:path";
const [, , entry, out, mockFulfill] = process.argv;
const M = path.resolve("mocks");
await esbuild.build({
  entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error",
  external: ["@electric-sql/pglite"],
  plugins: [{ name: "atrapy", setup(b) {
    b.onResolve({ filter: /\/supabase\.ts$/ }, () => ({ path: path.join(M, "supabase.mjs") }));
    b.onResolve({ filter: /\/settings\.ts$/ }, () => ({ path: path.join(M, "settings.mjs") }));
    b.onResolve({ filter: /\/smtp\.ts$/ }, () => ({ path: path.join(M, "smtp.mjs") }));
    if (mockFulfill === "1") b.onResolve({ filter: /\/fulfillOrder\.ts$/ }, () => ({ path: path.join(M, "fulfill.mjs") }));
    b.onResolve({ filter: /^(npm|node|jsr|https|base44):/ }, (a) => ({ path: a.path, external: true }));
  } }],
});
