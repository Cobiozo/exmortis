// Punkt wejścia danych dla całej aplikacji — wszystkie pliki importują stąd:
// `import { base44 } from "@/api/base44Client"`.
// Faktyczna implementacja jest w adapterze (./exmAdapter); przy przejściu na Supabase
// zmienia się adapter, a miejsca wywołań w kodzie pozostają bez zmian.

import { base44 } from "./exmAdapter";

export { base44 };