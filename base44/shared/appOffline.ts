// Przełącznik „Aplikacja offline" (PWA). Domyślnie włączony; wyłączony zdejmuje service workera u odwiedzających.
export const APLIKACJA_DEFAULT = { offline: true };

export function cleanAplikacja(data: any) {
  return { offline: data?.offline !== false };
}