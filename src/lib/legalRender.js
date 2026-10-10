import { REGULAMIN, WZOR } from "@/content/legal/regulamin";
import { PRYWATNOSC } from "@/content/legal/prywatnosc";
import { COOKIES, COOKIE_TABLE } from "@/content/legal/cookies";
import { fillFirma } from "@/lib/firma";
import { fillDocs } from "@/lib/legalFill";

export const LEGAL_DOCS = {
  regulamin: { doc: REGULAMIN, extra: [WZOR] },
  prywatnosc: { doc: PRYWATNOSC, extra: [] },
  cookies: { doc: COOKIES, extra: [] },
};

// Gotowa treść dokumentu (po wstawieniu pól) — ta sama dla strony i archiwum.
export function renderDoc(key, firma = {}, pola = {}) {
  const { doc, extra } = LEGAL_DOCS[key];
  const fill = (t) => fillDocs(fillFirma(t, firma), pola);
  return {
    title: doc.title,
    sections: [...doc.sections, ...extra].map((x) => ({
      id: x.id, title: x.title,
      body: x.body.map(fill).filter(Boolean),
      ...(x.table ? { table: COOKIE_TABLE.map((r) => r.map(fill)) } : {}),
    })),
  };
}

export const renderAll = (firma, pola) => Object.fromEntries(Object.keys(LEGAL_DOCS).map((k) => [k, renderDoc(k, firma, pola)]));