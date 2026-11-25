// Zwroty poczty (25.11.2026): serwer pocztowy przyjmuje wiadomość, a skrzynka odbiorcy odrzuca ją później —
// wtedy do kontakt@exmortis.pl przychodzi „Mail delivery failed”. Ten moduł raz na dobę czyta takie zwroty
// ze skrzynki (IMAP, tylko odczyt — nic nie usuwa i nie oznacza jako przeczytane), zapisuje odrzucone adresy
// w mail_undeliverable i zwraca listę do podsumowania dnia (z numerem zamówienia, jeśli jest).
// Dane logowania: te same co do wysyłki (Ustawienia → Wysyłka e-mail); serwer IMAP = serwer SMTP, port 993.
import { runSql, escStr } from "./supabase.ts";
import { getSetting } from "./settings.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const q = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function imapSession(host: string, user: string, pass: string, run: (cmd: (c: string) => Promise<string>) => Promise<void>) {
  const conn = await Deno.connectTls({ hostname: host, port: 993 });
  const buf = new Uint8Array(65536);
  let n = 0;
  const readUntil = async (re: RegExp, max = 3_000_000) => {
    let out = "";
    const t0 = Date.now();
    while (!re.test(out)) {
      if (Date.now() - t0 > 20000 || out.length > max) throw new Error("IMAP: limit czasu");
      const r = await conn.read(buf);
      if (r === null) break;
      out += dec.decode(buf.subarray(0, r));
    }
    return out;
  };
  try {
    await readUntil(/^\* OK/m);
    const cmd = async (c: string) => {
      const tag = `A${++n}`;
      await conn.write(enc.encode(`${tag} ${c}\r\n`));
      const res = await readUntil(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
      if (!new RegExp(`^${tag} OK`, "m").test(res)) throw new Error(`IMAP: ${c.split(" ")[0]} odrzucone`);
      return res;
    };
    await cmd(`LOGIN ${q(user)} ${q(pass)}`);
    await run(cmd);
    await cmd("LOGOUT").catch(() => {});
  } finally {
    try { conn.close(); } catch { /* już zamknięte */ }
  }
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const imapDate = (d: Date) => `${d.getUTCDate()}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

// Adresy odbiorców z treści zwrotu: format Exim („following address(es) failed: … adres”) i DSN („Final-Recipient: rfc822; adres”).
export function bounceRecipients(text: string, own: string[] = []) {
  const found = new Set<string>();
  for (const m of text.matchAll(/Final-Recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) found.add(m[1].toLowerCase());
  // Fragment tuż za zapowiedzią listy adresów (pierwsza pasująca zapowiedź, w kolejności pewności).
  let part = "";
  for (const re of [/address\(es\) failed:/i, /Delivery to the following recipients? failed/i, /could not be delivered to the following/i]) {
    const m = re.exec(text);
    if (m) { part = text.slice(m.index + m[0].length); break; }
  }
  part = part.split(/\n-{3,}|This is a copy of the message|Original message/i)[0]; // bez kopii wysłanej wiadomości
  if (part) for (const m of part.slice(0, 600).matchAll(/<?([A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>?/g)) found.add(m[1].toLowerCase());
  for (const o of own) found.delete(o.toLowerCase());
  return [...found].filter((a) => !/^(mailer-daemon|postmaster)@/.test(a));
}

// Zwroty z ostatnich `days` dni. Zwraca [{ email, reason, at }] i zapisuje je w mail_undeliverable. Błąd → [] (bez przerywania).
export async function collectBounces(base44, days = 2) {
  const s = await getSetting(base44, "smtp").catch(() => null);
  if (!s?.host || !s?.user || !s?.password) return [];
  const own = [s.user, s.from, s.reply_to].filter(Boolean).map(String);
  const out: { email: string; reason: string; at: string }[] = [];
  try {
    await imapSession(String(s.host), String(s.user), String(s.password), async (cmd) => {
      await cmd("EXAMINE INBOX"); // tylko odczyt
      const since = imapDate(new Date(Date.now() - days * 86400000));
      const res = await cmd(`SEARCH SINCE ${since} OR OR FROM "mailer-daemon" FROM "postmaster" SUBJECT "Delivery"`);
      const ids = ((res.match(/^\* SEARCH([\d ]*)$/m) || [])[1] || "").trim().split(/\s+/).filter(Boolean).slice(-40);
      for (const id of ids) {
        const body = await cmd(`FETCH ${id} (BODY.PEEK[HEADER.FIELDS (DATE SUBJECT)] BODY.PEEK[TEXT]<0.6000>)`);
        if (!/fail|undeliver|returned|niedostarcz|not be delivered|Delivery Status/i.test(body)) continue;
        const reason = ((body.match(/\b(5\d\d[ -]\d\.\d\.\d[^\r\n]{0,140})/) || [])[1] || "odrzucony przez serwer odbiorcy").trim();
        const at = ((body.match(/^Date:\s*(.+)$/mi) || [])[1] || "").trim();
        for (const email of bounceRecipients(body, own)) out.push({ email, reason, at });
      }
    });
  } catch (e) {
    console.error("zwroty poczty:", (e as Error)?.message);
    return [];
  }
  const uniq = [...new Map(out.map((b) => [b.email, b])).values()];
  if (uniq.length) {
    await runSql(base44, `CREATE TABLE IF NOT EXISTS public.mail_undeliverable (email text PRIMARY KEY, reason text, created_at timestamptz NOT NULL DEFAULT now())`).catch(() => {});
    for (const b of uniq) {
      await runSql(base44, `INSERT INTO public.mail_undeliverable (email, reason) VALUES (${escStr(b.email)}, ${escStr(b.reason.slice(0, 300))})
        ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason`).catch(() => {});
    }
  }
  return uniq;
}
