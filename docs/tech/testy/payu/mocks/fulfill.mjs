// Atrapa realizacji: liczy wywołania, można zaprogramować błąd; is_test jak w prawdziwej funkcji.
export const calls = globalThis.__fcalls || (globalThis.__fcalls = []);
export async function fulfillOrder(_b, stored, payuOrderId) {
  if (stored?.is_test === true) return { test: true };
  calls.push(payuOrderId);
  if (globalThis.__failFulfill && globalThis.__failFulfill(payuOrderId)) throw new Error("SYMULOWANY BŁĄD REALIZACJI");
}
