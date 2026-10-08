import React from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Edytor tylko ze stylami marki: bez dowolnych krojów, rozmiarów, kolorów, podkreśleń, kodu i obrazów.
const P = Quill.import("parchment");
if (!Quill.imports["formats/styl"]) {
  Quill.register({
    "formats/styl": new P.ClassAttributor("styl", "exm-styl", { scope: P.Scope.BLOCK, whitelist: ["lead", "etykieta", "maly"] }),
    "formats/akcent": new P.ClassAttributor("akcent", "exm-akcent", { scope: P.Scope.INLINE, whitelist: ["zloty", "bordo"] }),
  }, true);
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }, { styl: [false, "lead", "etykieta", "maly"] }],
    ["bold", "italic", { akcent: [false, "zloty", "bordo"] }],
    ["link", { list: "bullet" }, { list: "ordered" }, "blockquote"],
    ["clean"],
  ],
  clipboard: { matchVisual: false },
};
const formats = ["header", "styl", "bold", "italic", "akcent", "list", "blockquote", "link"];

export default function CmsRichText({ value, onChange }) {
  return (
    <div className="rich-admin rich-mobile rich-brand">
      <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={modules} formats={formats} />
    </div>
  );
}