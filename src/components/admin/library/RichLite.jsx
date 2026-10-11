import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Edytor materiału tekstowego: tylko pogrubienie, kursywa, listy, nagłówki i link.
// Wklejanie jest odzierane ze stylów (kolory, czcionki, tabele) — zostaje sam sens.
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

export default function RichLite({ value, onChange }) {
  return (
    <div className="rich-admin">
      <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={modules} formats={formats} placeholder="Treść materiału…" />
    </div>
  );
}