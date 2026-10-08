import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CONTENT_PAGES as ALL } from "@/content/registry";

// O mnie i Głos są już w edytorze stron.
const CONTENT_PAGES = ALL.filter((p) => !["about", "glos"].includes(p.key));
import BlockEditor from "./BlockEditor";

export default function ContentManager() {
  const [overrides, setOverrides] = useState(null);
  const [pageKey, setPageKey] = useState(CONTENT_PAGES[0].key);

  const load = () => {
    base44.functions
      .invoke("adminContent", { action: "list" })
      .then((res) => {
        const map = {};
        for (const row of res.data.content || []) {
          map[`${row.page_key}.${row.block_key}`] = row.value;
        }
        setOverrides(map);
      })
      .catch(() => setOverrides({}));
  };
  useEffect(load, []);

  if (overrides === null) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 border hairline animate-pulse bg-[#0F0F10]" />
        ))}
      </div>
    );
  }

  const page = CONTENT_PAGES.find((p) => p.key === pageKey) || CONTENT_PAGES[0];

  const save = (block, value) =>
    base44.functions.invoke("adminContent", { action: "save", page: pageKey, key: block.key, value }).then(load);

  const reset = (block) =>
    base44.functions.invoke("adminContent", { action: "delete", page: pageKey, key: block.key }).then(load);

  const pageTabBtn = (active) =>
    `px-5 py-2.5 technical text-[10px] border transition-colors ${
      active ? "border-[#C9A24A] gold-text bg-[#C9A24A]/5" : "hairline text-foreground/50 hover:text-foreground"
    }`;

  return (
    <div>
      <p className="technical text-[10px] text-foreground/40 mb-6">
        EDYTUJ TREŚCI — ZMIANY SĄ OD RAZU WIDOCZNE W SERWISIE
      </p>

      <div className="flex flex-wrap gap-2 mb-10">
        {CONTENT_PAGES.map((p) => (
          <button key={p.key} onClick={() => setPageKey(p.key)} className={pageTabBtn(p.key === pageKey)}>
            {p.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {page.blocks.map((b) => (
          <BlockEditor
            key={b.key}
            block={b}
            value={overrides[`${pageKey}.${b.key}`]}
            modified={overrides[`${pageKey}.${b.key}`] !== undefined}
            onSave={(v) => save(b, v)}
            onReset={() => reset(b)}
          />
        ))}
      </div>
    </div>
  );
}