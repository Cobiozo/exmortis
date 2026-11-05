import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// Dane kontaktowe z konta (5.11.2026): zalogowana osoba nie wpisuje imienia ani e-maila w formularzach
// zapisu i darmowych materiałów. „Zmień” pokazuje pola (np. zapis innego adresu). Zgody — nigdy z automatu.
export function useAccountContact() {
  const { user, isAuthenticated } = useAuth();
  const email = isAuthenticated && user?.email ? String(user.email).toLowerCase() : "";
  const name = isAuthenticated ? String(user?.imie || user?.full_name || "").trim() : "";
  return { signedIn: !!email, email, name, firstName: name.split(/\s+/)[0] || "" };
}

// Uzupełnia stan formularza danymi z konta (tylko puste pola) — dla formularzy z własnym stanem.
export function useAccountPrefill(apply) {
  const acc = useAccountContact();
  useEffect(() => { if (acc.signedIn) apply(acc); }, [acc.signedIn, acc.email, acc.name]);
  return acc;
}

// Linijka „Wyślę na: …” z przyciskiem „zmień” (dla zalogowanych).
export function AccountContactLine({ email, lead = "Wyślę na:", onChange }) {
  return (
    <div className="border hairline px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
      <p className="text-[#F5EFE1]/80 min-w-0 break-all">
        {lead} <span className="text-[#F5EFE1]">{email}</span> <span className="text-[#F5EFE1]/60">(Twoje konto)</span>
      </p>
      <button type="button" onClick={onChange} className="min-h-[44px] gold-text underline underline-offset-4 hover:text-[#F5EFE1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
        zmień
      </button>
    </div>
  );
}

// Dla niezalogowanych: zaproszenie do logowania z powrotem na tę samą stronę.
export function SignInHint() {
  const { pathname, search } = useLocation();
  return (
    <p className="text-sm text-[#F5EFE1]/70">
      Masz konto?{" "}
      <Link to={`/login?returnTo=${encodeURIComponent(pathname + search)}`} className="gold-text underline underline-offset-4 hover:text-[#F5EFE1]">Zaloguj się</Link>
      {" "}— nie będziesz nic wpisywać.
    </p>
  );
}
