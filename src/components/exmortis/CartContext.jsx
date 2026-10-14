import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { unitPrice, priceOnRequest } from "@/lib/productPrice";

const MAX_QTY = 20; // tyle przyjmuje kasa na serwerze

const CartContext = createContext(null);

const STORAGE_KEY = "exmortis_cart";

// Karta podarunkowa: kwoty do wyboru (price_options) albo zwykła cena; każda karta to osobna pozycja (inne imię i słowa).
export const cardAmounts = (p) => {
  const o = Array.isArray(p?.price_options) ? p.price_options.map(Number).filter((n) => n > 0) : [];
  return o.length ? [...new Set(o)].sort((a, b) => a - b) : [unitPrice(p)].filter((n) => n > 0);
};
export const lineKey = (i) => i.key || i.id;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const addItem = useCallback((product, qty = 1, gift = null) => {
    if (product.product_type === "karta" && gift) {
      const amount = Number(gift.amount);
      setItems((prev) => [...prev, {
        key: `${product.id}:${amount}:${Date.now().toString(36)}`,
        id: product.id, name: product.name, price: amount, image_url: product.image_url, slug: product.slug,
        product_type: product.product_type, qty: 1,
        gift: { amount, to_name: String(gift.to_name || "").slice(0, 60), message: String(gift.message || "").slice(0, 200) },
      }]);
      setOpen(true);
      return;
    }
    setItems((prev) => {
      const existing = prev.find((i) => !i.key && i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          !i.key && i.id === product.id ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: unitPrice(product),
          image_url: product.image_url,
          slug: product.slug,
          product_type: product.product_type,
          access_months: product.access_months,
          qty: Math.min(MAX_QTY, qty),
        },
      ];
    });
    setOpen(true);
  }, []);

  // Pozycje rozpoznawane po kluczu (karty podarunkowe) albo po id produktu.
  const removeItem = useCallback((k) => {
    setItems((prev) => prev.filter((i) => lineKey(i) !== k));
  }, []);

  const updateQty = useCallback((k, qty) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (lineKey(i) === k ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)));
  }, []);

  // Aktualne ceny i dostępność z serwera (np. koniec promocji, produkt wycofany) — zwraca true, gdy coś się zmieniło.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const refresh = useCallback((products) => {
    const byId = new Map((products || []).map((p) => [String(p.id), p]));
    let changed = false;
    const next = [];
    for (const i of itemsRef.current) {
      const p = byId.get(String(i.id));
      if (!p || p.status === "wkrótce" || p.status === "ukryty" || p.is_free || (priceOnRequest(p) && !i.gift)) { changed = true; continue; }
      if (i.gift) {
        // Karta: kwota musi nadal być w ofercie — inaczej pozycja znika (serwer i tak by ją odrzucił).
        if (p.product_type !== "karta" || !cardAmounts(p).includes(Number(i.gift.amount))) { changed = true; continue; }
        if (p.name !== i.name) changed = true;
        next.push({ ...i, name: p.name, image_url: p.image_url, price: Number(i.gift.amount) });
        continue;
      }
      const price = unitPrice(p);
      if (price !== i.price || p.name !== i.name) changed = true;
      next.push({ ...i, price, name: p.name, image_url: p.image_url, product_type: p.product_type, access_months: p.access_months });
    }
    if (changed) setItems(next);
    return changed;
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQty, refresh, clear, count, total, open, setOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}