// Edycja tekstu w miejscu: dwuklik na tekście, który jest wprost polem bloku (bez formatowania).
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function startInlineEdit(e, blocks, post) {
  const host = e.target.closest("[data-block]");
  const block = host && blocks.find((b) => b.id === host.dataset.block);
  if (!block) return;
  const el = e.target;
  const text = norm(el.innerText);
  if (!text || el.children.length > 1) return;
  const key = Object.keys(block.dane || {}).find((k) => typeof block.dane[k] === "string" && !/<[a-z]/i.test(block.dane[k]) && norm(block.dane[k]) === text);
  if (!key) return;
  const before = el.innerText;
  el.contentEditable = "plaintext-only";
  el.style.outline = "1px dashed #C9A24A";
  el.style.cursor = "text";
  el.focus();
  const done = (save) => {
    el.removeEventListener("blur", onBlur);
    el.removeEventListener("keydown", onKey);
    el.contentEditable = "false";
    el.style.outline = "";
    el.style.cursor = "";
    if (!save) { el.innerText = before; return; }
    if (el.innerText !== before) post({ type: "cms-edit", id: block.id, key, value: el.innerText.trim() });
  };
  const onBlur = () => done(true);
  const onKey = (k) => {
    k.stopPropagation();
    if (k.key === "Escape") { done(false); el.blur(); }
    if (k.key === "Enter" && !k.shiftKey) { k.preventDefault(); el.blur(); }
  };
  el.addEventListener("blur", onBlur);
  el.addEventListener("keydown", onKey);
}