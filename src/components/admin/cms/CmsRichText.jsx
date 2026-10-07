import React from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// Edytor ograniczony do stylów marki. Lista formatów = wklejka z Worda/Docs traci kolory, kroje i rozmiary.
const modules = {
  toolbar: [[{ header: [2, 3, false] }], ["bold", "italic"], [{ list: "ordered" }, { list: "bullet" }], ["blockquote", "link"], ["clean"]],
  clipboard: { matchVisual: false },
};
const formats = ["header", "bold", "italic", "list", "blockquote", "link"];

export default function CmsRichText({ value, onChange }) {
  return (
    <div className="rich-admin rich-mobile">
      <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={modules} formats={formats} />
    </div>
  );
}