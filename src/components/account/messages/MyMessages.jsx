import React, { useEffect, useState } from "react";
import { myMessages, readMessage, hideMessage } from "@/components/account/library/libApi";
import MaterialSheet from "@/components/account/library/MaterialSheet";
import MessageCard from "./MessageCard";

// „Wiadomości": od najnowszej. Otwarcie oznacza jako przeczytaną, „Ukryj" zdejmuje z listy.
export default function MyMessages({ footer }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openMat, setOpenMat] = useState(null);

  useEffect(() => { myMessages().then(setData).catch(() => setErr("Nie udało się wczytać wiadomości.")); }, []);

  const read = async (id) => {
    setData((d) => ({ ...d, items: d.items.map((m) => (m.id === id ? { ...m, read_at: m.read_at || new Date().toISOString() } : m)) }));
    await readMessage(id).catch(() => {});
  };

  const hide = async (id) => {
    setData((d) => ({ ...d, items: d.items.filter((m) => m.id !== id) }));
    await hideMessage(id).catch(() => {});
  };

  const openAttachment = (materialId, attach) => {
    if (materialId) setOpenMat({ id: materialId, title: attach.title, kind: attach.kind });
  };

  if (err) return <p className="font-body text-[15px] text-[#F5EFE1]/70 py-10">{err}</p>;
  if (!data) return <p className="text-foreground/50 font-body py-10">Ładowanie…</p>;

  if (!data.items.length) {
    return (
      <div className="py-16 text-center">
        <p className="shop-heading text-2xl text-[#F5EFE1]">Nie ma tu żadnej wiadomości.</p>
        <p className="font-body text-[15px] leading-relaxed text-foreground/55 mt-4 max-w-[46ch] mx-auto">
          Gdy napiszę do Ciebie kilka słów albo wyślę materiał, zobaczysz to właśnie tutaj.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.items.map((m) => (
        <MessageCard key={m.id} m={m} footer={footer} onRead={read} onHide={hide} onOpenMaterial={openAttachment} />
      ))}
      {openMat && (
        <MaterialSheet material={openMat} completed={false} onClose={() => setOpenMat(null)} onCompleted={() => {}} />
      )}
    </div>
  );
}