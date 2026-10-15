import React from "react";
import { Field, Input, Group, Chips, Toggle, inputCls } from "./ui";
import { REG_TYPES } from "./eventForm";
import JoinPreviewLinks from "./JoinPreviewLinks";
import ZoomChoice from "@/components/admin/zoom/ZoomChoice";
import RecordingField from "./RecordingField";

export default function StepAccess(p) {
  const { form: f, set } = p;
  const tix = f.format === "Stacjonarnie" && f.tickets === true; // bilety tylko na spotkania stacjonarne
  return (
    <div className="space-y-8">
      <Group title="Miejsce">
        <Field id="format" label="Forma">
          <Chips label="Forma" value={f.format} options={[["Online", "Online"], ["Stacjonarnie", "Stacjonarnie"]]} onChange={(v) => set({ format: v })} />
        </Field>
        {f.format === "Stacjonarnie" ? (
          <div className="space-y-3">
            <Input id="location" label="Adres (widzą go tylko zapisani) *" {...p} />
            <Toggle id="tickets" label="Bilety z kodem QR i skanowanie przy wejściu" checked={f.tickets === true} onChange={(v) => set({ tickets: v })} />
            {f.tickets && (
              <p className="text-sm text-foreground/55 leading-relaxed">
                {f.paid ? "Spotkanie płatne: bilet kupuje się na stronie (PayU), bilet PDF przychodzi po opłaceniu." : "Spotkanie darmowe: bilet przychodzi w e-mailu potwierdzającym zapis (lista rezerwowa — po awansie, wypisanie anuluje bilet)."}{" "}
                Wzór biletu, listę biletów i osoby, które mogą je skanować, ustawisz po zapisaniu: lista spotkań → przycisk „BILETY”.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <Field id="join_link_choice" label="Link do pokoju">
              <ZoomChoice link={f.join_link} withPassword error={p.errors?.join_link} onSet={({ link, haslo }) => set({ join_link: link, join_password: haslo })}>
                <div className="grid md:grid-cols-2 gap-5">
                  <Input id="join_link" type="url" inputMode="url" label="Link do Zoom (dla uczestników, z wbudowanym hasłem)" hint="Możesz dodać później, nawet w dniu spotkania. Zapisani dostają osobisty adres strony dołączenia, nie ten link." {...p} />
                  <Input id="join_password" label="Hasło do pokoju (opcjonalnie)" hint="Gdy link nie ma wbudowanego hasła" {...p} />
                </div>
              </ZoomChoice>
            </Field>
            <Input id="open_minutes" type="number" min="0" max="120" inputMode="numeric" label="Otwarcie pokoju: minut przed startem" {...p} />
            <Input id="short_path" label="Krótki adres (opcjonalnie)" hint={f.short_path ? `Także /${f.short_path}/dolacz` : "np. 1-listopada"} {...p} />
            <Toggle id="zoom_faq" label="Pokaż pytania o Zoom na stronie spotkania" checked={f.zoom_faq !== false} onChange={(v) => set({ zoom_faq: v })} />
            <JoinPreviewLinks slug={f.id ? f.slug : ""} />
          </div>
        )}
      </Group>
      <Group title="Cena">
        <Toggle id="paid" label="Spotkanie płatne" checked={f.paid} onChange={(v) => set({ paid: v })} />
        {f.paid && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <Input id="price" type="number" min="0" step="0.01" inputMode="decimal" label={tix ? "Cena biletu (zł) *" : "Cena (zł) *"} {...p} />
              {!tix && <Input id="checkout_url" type="url" inputMode="url" label="Link płatności (zewnętrzny) *" {...p} />}
            </div>
            {tix && <p className="text-sm text-foreground/55 leading-relaxed">Sprzedaż biletów na stronie przez PayU. Limit miejsc niżej działa też dla biletów.</p>}
          </div>
        )}
      </Group>
      <Group title="Zapisy">
        <Field id="registration_type" label="Sposób zapisu">
          <Chips label="Sposób zapisu" value={f.registration_type} options={REG_TYPES.map((t) => [t, t])} onChange={(v) => set({ registration_type: v })} />
        </Field>
        {(f.registration_type === "Link zewnętrzny" || f.format === "Online") && (
          <Input id="external_url" type="url" inputMode="url" label="Link zewnętrzny (transmisja FB/IG/YT)" {...p} />
        )}
        {f.registration_type === "Zapis na stronie" && (
          <>
            <Toggle id="limit" label="Limit miejsc" checked={f.capacity !== "" && f.capacity !== null} onChange={(v) => set({ capacity: v ? 30 : "" })} />
            {f.capacity !== "" && f.capacity !== null && <Input id="capacity" type="number" min="1" inputMode="numeric" label="Liczba miejsc" {...p} />}
            <div className="grid md:grid-cols-2 gap-5">
              <Input id="registration_deadline" type="datetime-local" label="Zapisy do" {...p}
                hint={p.form.deadline_manual ? "Ustawione ręcznie" : "Automatycznie 15 minut przed startem"}
                onChange={(e) => p.set({ registration_deadline: e.target.value, deadline_manual: true })} />
              <Input id="mailing_group" label="Grupa mailingowa dla zapisanych" placeholder="np. Webinar 1.11" {...p} />
            </div>
            <Input id="what_registered" label="Co dostają zapisani (pozycje oddziel średnikiem ;)" placeholder="np. Indywidualny link do Zoom; Zamknięta sesja pytań i odpowiedzi" {...p} />
          </>
        )}
      </Group>
      <Group title="Nagranie (tylko w kontach zapisanych)">
        <RecordingField {...p} />
      </Group>
      <Group title="Adres strony">
        <Field id="slug" label="Adres (slug)" hint={`/spotkania/${f.slug || "tworzony-z-tytulu"}`}>
          <input id="slug" value={f.slug} onChange={(e) => set({ slug: e.target.value })} className={inputCls} placeholder="automatycznie z tytułu" />
        </Field>
      </Group>
    </div>
  );
}