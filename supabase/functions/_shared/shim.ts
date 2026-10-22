// Zamiennik modułu "base44:runtime" dla Supabase Edge Functions.
// Wygenerowane pliki importują: secrets (odczyt zmiennych środowiskowych) i waitUntil.
export const secrets = {
  get: (k: string) => Deno.env.get(k) ?? null,
};

// Zadania w tle — w Supabase Edge jest globalne EdgeRuntime.waitUntil.
export const waitUntil = (p: Promise<unknown>) => {
  try {
    (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (x: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(p);
  } catch { /* brak środowiska edge — obietnica wykona się sama */ }
};