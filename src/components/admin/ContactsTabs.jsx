import React from "react";
import { Link } from "react-router-dom";
import ContactsPanel from "./ContactsPanel";

// Zgłoszenia gości do podcastu są od 27.11.2026 w sekcji Głos → Podcast → Zgłoszenia gości.
export default function ContactsTabs() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-foreground/55">
        Zgłoszenia do podcastu znajdziesz teraz w{" "}
        <Link to="/admin/glos?widok=podcast&tab=zgloszenia" className="gold-text hover:underline">Głos → Podcast → Zgłoszenia gości</Link>.
      </p>
      <ContactsPanel />
    </div>
  );
}
