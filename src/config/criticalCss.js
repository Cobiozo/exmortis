// Krytyczny CSS dla powłoki strony startowej (src/content/landingShell.html).
// Z pełnego arkusza (Tailwind) zostawia tylko reguły, które mogą dotyczyć elementów powłoki
// (klasy, znaczniki, id i atrybuty obecne w jej HTML) + reguły ogólne (:root, html, body, *, @font-face, @keyframes).
// Metoda ostrożna: przy wątpliwości reguła ZOSTAJE (nadmiar nie psuje wyglądu, brak by psuł).
// Pełny arkusz i tak ładuje się zaraz po pierwszym obrazie strony (vite.config.js → exmInlineCss).
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

function inventory(html) {
  const classes = new Set(), tags = new Set(["html", "body"]), ids = new Set(), attrs = new Set();
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    tags.add(m[1].toLowerCase());
    for (const a of m[2].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const name = a[1].toLowerCase(), val = (a[2] || "").replace(/^["']|["']$/g, "");
      attrs.add(name);
      if (name === "class") val.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
      if (name === "id") ids.add(val);
    }
  }
  return { classes, tags, ids, attrs };
}

// Czy pojedynczy selektor (np. ".md\:px-10 > a:hover::before") może pasować do czegoś w powłoce.
function selectorMayMatch(sel, inv) {
  let ok = true;
  sel.walk((n) => {
    if (!ok) return;
    if (n.type === "pseudo" && /^::?(not|is|where|has)$/.test(n.value)) return; // zawartość funkcji pomijamy (ostrożnie)
    if (n.parent && n.parent.type === "selector" && n.parent.parent && n.parent.parent.type === "pseudo") return;
    if (n.type === "class" && !inv.classes.has(n.value)) ok = false;
    else if (n.type === "id" && !inv.ids.has(n.value)) ok = false;
    else if (n.type === "tag" && !inv.tags.has(n.value.toLowerCase())) ok = false;
    else if (n.type === "attribute" && !inv.attrs.has(String(n.attribute).toLowerCase())) ok = false;
  });
  return ok;
}

export function criticalCss(fullCss, shellHtml) {
  const inv = inventory(shellHtml);
  const root = postcss.parse(fullCss);
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    let keep = false;
    try {
      selectorParser((sels) => { sels.each((s) => { if (!keep && selectorMayMatch(s, inv)) keep = true; }); }).processSync(rule.selector);
    } catch { keep = true; }
    if (!keep) rule.remove();
  });
  // Puste @media / @supports po usunięciu reguł.
  let changed = true;
  while (changed) {
    changed = false;
    root.walkAtRules((at) => { if (/^(media|supports|layer|container)$/i.test(at.name) && at.nodes && at.nodes.length === 0) { at.remove(); changed = true; } });
  }
  return root.toString();
}