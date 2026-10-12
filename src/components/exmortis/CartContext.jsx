import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { unitPrice, priceOnRequest } from "@/lib/productPrice";

const MAX_QTY = 20; // tyle przyjmuje kasa na serwerze

const CartContext = createContext(null);

const STORAGE_KEY = "exmortis_cart";

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

  const addItem = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i
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

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)));
  }, []);

  // Aktualne ceny i dostępność z serwera (np. koniec promocji, produkt wycofany) — zwraca true, gdy coś się zmieniło.
  const refresh = useCallback((products) => {
    const byId = new Map((products || []).map((p) => [String(p.id), p]));
    let changed = false;
    setItems((prev) => {
      const next = [];
      for (const i of prev) {
        const p = byId.get(String(i.id));
        if (!p || p.status === "wkrótce" || p.status === "ukryty" || p.is_free || priceOnRequest(p)) { changed = true; continue; }
        const price = unitPrice(p);
        if (price !== i.price || p.name !== i.name) changed = true;
        next.push({ ...i, price, name: p.name, image_url: p.image_url, product_type: p.product_type, access_months: p.access_months });
      }
      return changed ? next : prev;
    });
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