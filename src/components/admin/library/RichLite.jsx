import React, { useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Edytor treści: tylko pogrubienie, kursywa, listy, nagłówki i link.
// Tryb znaczeniowy (getSemanticHTML) jest niekontrolowany, więc kursor nie przeskakuje przy pisaniu.
// Wklejanie jest odzierane ze stylów (kolory, czcionki, tabele) — zostaje sam sens.
// `semantic` zwraca HTML znaczeniowy (getSemanticHTML), `token` dokłada przycisk {imię}.
const KEEP = ["bold", "italic", "list", "header", "link", "ordered", "bullet"];

const clean = (delta) => {
  delta.ops = (delta.ops || []).map((op) => {
    if (!op.attributes) return op;
    const a = {};
    for (const k of KEEP) if (op.attributes[k] !== undefined) a[k] = op.attributes[k];
    return Object.keys(a).length ? { insert: op.insert, attributes: a } : { insert: op.insert };
  });
  return delta;
};

const modules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
  clipboard: { matchers: [[Node.ELEMENT_NODE, (node, delta) => clean(delta)]] },
};

const formats = ["header", "bold", "italic", "list", "bullet", "link"];

export default function RichLite({ value, onChange, semantic, token, placeholder }) {
  const ref = useRef(null);

  const emit = (content, _delta, _source, editor) => {
    onChange(semantic && editor ? editor.getSemanticHTML() : content);
  };

  // Wstawienie {imię} w miejscu kursora — działa też w trybie znaczeniowym.
  const insertToken = () => {
    const q = ref.current?.getEditor?.();
    if (!q) return;
    const sel = q.getSelection(true);
    const at = sel ? sel.index : Math.max(0, q.getLength() - 1);
    q.insertText(at, "{imię}", "user");
    q.setSelection(at + 6, 0);
  };

  return (
    <div className="rich-admin">
      {token && (
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <button type="button" onClick={insertToken} className="btn-ghost !px-3 !py-2">WSTAW {"{imię}"}</button>
          <span className="text-xs text-foreground/45">gdy brak imienia, zdanie zostanie dopasowane</span>
        </div>
      )}
      {semantic ? (
        <ReactQuill ref={ref} theme="snow" defaultValue={value || ""} onChange={emit}
          modules={modules} formats={formats} placeholder={placeholder || "Treść materiału…"} />
      ) : (
        <ReactQuill ref={ref} theme="snow" value={value || ""} onChange={emit}
          modules={modules} formats={formats} placeholder={placeholder || "Treść materiału…"} />
      )}
    </div>
  );
}