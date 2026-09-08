import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useCart } from "@/components/exmortis/CartContext";

export default function Checkout() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", note: "" });

  const submit = (e) => {
    e.preventDefault();
    setDone(true);
    clear();
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 px-6 text-center gap-8">
        <div className="w-16 h-16 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
          <Check className="h-8 w-8 gold-text" />
        </div>
        <h1 className="relic-heading text-4xl md:text-6xl gold-text">Przyjęte</h1>
        <p className="text-foreground/60 text-lg max-w-md leading-relaxed">
          Pierwszy ruch zrobiony. Dostęp i szczegóły wyślę na Twój mail.
          Powrót nie kończy się na jednym kroku — dopiero się nim zaczyna.
        </p>
        <Link to="/" className="btn-ghost">WRÓĆ NA POCZĄTEK</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 px-6 text-center gap-8">
        <p className="relic-heading text-4xl text-foreground/40">Skarbiec pusty</p>
        <p className="text-foreground/60">Nie masz jeszcze nic na drodze powrotu.</p>
        <Link to="/sklep" className="btn-relic">DO SKLEPU <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="mx-auto max-w-[1100px] px-5 md:px-10 py-16 md:py-24">
        <p className="technical text-[11px] gold-text mb-6">KASA · FINALNY RUCH</p>
        <h1 className="relic-heading text-4xl md:text-6xl mb-16 leading-[0.95]">
          Przejdź<br /><span className="gold-text">przez próg</span>
        </h1>

        <div className="grid md:grid-cols-5 gap-10">
          {/* Form */}
          <form onSubmit={submit} className="md:col-span-3 space-y-8">
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">EMAIL</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-3">NOTATKA (opcjonalnie)</label>
              <textarea
                rows={4}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
              />
            </div>

            <button type="submit" className="btn-relic w-full">
              POTWIERDŹ POWRÓT <ArrowRight className="h-4 w-4" />
            </button>
            <p className="technical text-[10px] text-foreground/40">
              Płatność uruchamiana ręcznie — wkrótce po zapisie otrzymasz link do uregulowania.
            </p>
          </form>

          {/* Summary */}
          <div className="md:col-span-2">
            <div className="border hairline p-6 space-y-4 sticky top-28">
              <p className="technical text-[11px] gold-text pb-4 border-b hairline">TWOJE ZAPISY</p>
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-14 h-14 bg-card border hairline overflow-hidden flex-shrink-0">
                    {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="relic-heading text-sm gold-text truncate">{item.name}</p>
                    <p className="font-mono text-xs text-foreground/50">{item.qty} × {item.price} zł</p>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t hairline flex justify-between items-center">
                <span className="technical text-[11px] text-foreground/60">RAZEM</span>
                <span className="font-mono text-2xl gold-text">{total} zł</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}