// Numery pomocy kryzysowej jako linki „zadzwoń” (w treści HTML z edytora).
export const PHONES = [["116 123", "116123", "Telefon Zaufania dla Dorosłych"], ["800 70 2222", "800702222", "Centrum Wsparcia, całą dobę"], ["112", "112", "numer alarmowy"]];

// Działa też dla numerów w <strong>; numerów już podlinkowanych w treści (tel:…) nie rusza.
export function linkPhones(html = "") {
  return PHONES.reduce((out, [shown, tel, desc]) => out.includes(`tel:${tel}`) ? out :
    out.replace(new RegExp(`(?<![\\d:])${shown.replace(/ /g, "[ \\u00a0]")}(?![\\d"])`, "g"),
      `<a href="tel:${tel}" aria-label="Zadzwoń: ${shown} — ${desc}" class="gold-text underline">${shown}</a>`), html);
}