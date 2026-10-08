// Czyszczenie HTML z dozwoloną listą znaczników i atrybutów.
const TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "A", "BLOCKQUOTE", "PRE", "CODE", "SPAN", "IMG", "HR", "DIV"]);
const ATTRS = { A: ["href"], IMG: ["src", "alt"], BLOCKQUOTE: ["class"], SPAN: ["class"], P: ["class"], DIV: ["class"], H1: ["class"], H2: ["class"], H3: ["class"], LI: ["class"], STRONG: ["class"], EM: ["class"] };

export function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (!TAGS.has(el.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM"].includes(el.tagName)) el.remove();
        else { walk(el); el.replaceWith(...el.childNodes); }
        return;
      }
      const ok = ATTRS[el.tagName] || [];
      [...el.attributes].forEach((a) => { if (!ok.includes(a.name)) el.removeAttribute(a.name); });
      ["href", "src"].forEach((k) => {
        const v = el.getAttribute(k);
        if (v && !/^(https:\/\/|\/|#|mailto:|tel:)/i.test(v.trim())) el.removeAttribute(k);
      });
      if (el.tagName === "A" && /^https:/i.test(el.getAttribute("href") || "")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      walk(el);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}