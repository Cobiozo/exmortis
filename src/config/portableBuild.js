import path from "node:path";

// Base44 supplies a /src/ alias; resolve it to a real filesystem path as well
// on Windows, including project directories whose names contain spaces.
export default function portableBuild(projectRoot) {
  const source = path.resolve(projectRoot, "src").replace(/\\/g, "/");
  return {
    name: "exm-portable-build",
    enforce: "post",
    config() {
      return {
        root: projectRoot,
        resolve: { alias: { "@/": `${source}/` } },
      };
    },
    buildEnd(error) {
      if (!error) return;
      // Rolldown exposes nested errors through a getter, which Node's default
      // error display abbreviates to `errors: [Getter/Setter]`.
      const details = Array.isArray(error.errors) ? error.errors : [error];
      console.error("\n[exmortis] Budowanie przerwane. Przyczyna:");
      for (const detail of details) {
        console.error(detail.message || String(detail));
        if (detail.id) console.error(`Plik: ${detail.id}`);
        if (detail.frame) console.error(detail.frame);
      }
    },
  };
}