import React, { createContext, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const ContentCtx = createContext(null);

// Ładuje raz nadpisania treści z panelu admina i udostępnia je stronom.
// Bez nadpisania strony używają wartości domyślnych z kodu.
export function SiteContentProvider({ children }) {
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    base44.functions
      .invoke("siteContent", {})
      .then((res) => {
        const map = {};
        for (const row of res.data.content || []) {
          map[`${row.page_key}.${row.block_key}`] = row.value;
        }
        setOverrides(map);
      })
      .catch(() => {});
  }, []);

  const value = {
    raw: overrides,
    str: (page, key, fallback) =>
      typeof overrides[`${page}.${key}`] === "string" ? overrides[`${page}.${key}`] : fallback,
    rich: (page, key, fallback) =>
      typeof overrides[`${page}.${key}`] === "string" ? overrides[`${page}.${key}`] : fallback,
    list: (page, key, fallback) =>
      Array.isArray(overrides[`${page}.${key}`]) ? overrides[`${page}.${key}`] : fallback,
    cards: (page, key, fallback) =>
      Array.isArray(overrides[`${page}.${key}`]) ? overrides[`${page}.${key}`] : fallback,
  };

  return <ContentCtx.Provider value={value}>{children}</ContentCtx.Provider>;
}

export function useSiteContent() {
  const ctx = useContext(ContentCtx);
  if (!ctx) throw new Error("useSiteContent musi być w SiteContentProvider");
  return ctx;
}