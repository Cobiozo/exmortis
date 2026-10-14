import { ModuleBlock } from "./modules";

// Punkt wejścia dla bloków „moduł”: cała treść modułów (47 KB gzip) trafia do osobnego pliku
// i jest dociągana dopiero wtedy, gdy blok modułu faktycznie wchodzi na stronę.
export default ModuleBlock;