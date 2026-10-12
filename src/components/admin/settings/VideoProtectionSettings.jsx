import React, { useEffect, useState } from "react";
import { Loader2, Download, ShieldCheck, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Skrypt dla serwera z filmami (PHP + Apache, typowy hosting). Wpuszcza tylko podpisane linki /v/… przed terminem
// i obsługuje przewijanie (Range). Pliki leżą w katalogu _wideo/, do którego nie ma wejścia z przeglądarki.
const phpScript = (key) => `<?php
// exmortis.pl — odtwarzanie filmów kursu wyłącznie z podpisanym linkiem (generuje go exmortis.pl).
$KLUCZ = '${key}';
$KATALOG = __DIR__ . '/_wideo/';

$f = isset($_GET['f']) ? (string)$_GET['f'] : '';
$e = isset($_GET['e']) ? (int)$_GET['e'] : 0;
$t = isset($_GET['t']) ? (string)$_GET['t'] : '';
if ($f === '' || strpos($f, '..') !== false || !preg_match('#^[A-Za-z0-9/_.-]+\\.(mp4|m4v|webm)$#', $f)) { http_response_code(404); exit; }
if ($e < time() || !hash_equals(hash_hmac('sha256', $f . '|' . $e, $KLUCZ), $t)) { http_response_code(403); exit('Link wygasl. Odswiez strone kursu.'); }
$path = $KATALOG . $f;
if (!is_file($path)) { http_response_code(404); exit; }

$size = filesize($path); $start = 0; $end = $size - 1;
while (ob_get_level()) ob_end_clean();
header('Content-Type: ' . (substr($f, -5) === '.webm' ? 'video/webm' : 'video/mp4'));
header('Accept-Ranges: bytes');
header('Cache-Control: private, max-age=3600');
header('Content-Disposition: inline');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\\d*)-(\\d*)/', $_SERVER['HTTP_RANGE'], $m)) {
  if ($m[1] === '' && $m[2] !== '') { $start = max(0, $size - (int)$m[2]); }
  else { $start = (int)$m[1]; if ($m[2] !== '') { $end = min((int)$m[2], $size - 1); } }
  if ($start > $end || $start >= $size) { http_response_code(416); header("Content-Range: bytes */$size"); exit; }
  http_response_code(206);
  header("Content-Range: bytes $start-$end/$size");
}
header('Content-Length: ' . ($end - $start + 1));
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
@set_time_limit(0);
$fp = fopen($path, 'rb');
fseek($fp, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($fp) && !connection_aborted()) {
  $chunk = fread($fp, (int)min(1048576, $left));
  echo $chunk; flush();
  $left -= strlen($chunk);
}
fclose($fp);
`;

const HTACCESS_ROOT = `RewriteEngine On
RewriteRule ^v/(.+)$ stream.php?f=$1 [QSA,L]
`;
const HTACCESS_FILES = `# Brak bezpośredniego dostępu do plików wideo
Require all denied
<IfModule !mod_authz_core.c>
  Deny from all
</IfModule>
`;

function save(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function VideoProtectionSettings() {
  const [s, setS] = useState(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => base44.functions.invoke("adminSettings", { action: "video_get" }).then((r) => setS(r.data)).catch(() => setS(false));
  useEffect(() => { load(); }, []);

  const act = async (action, extra = {}) => {
    setBusy(action); setMsg("");
    try {
      const r = await base44.functions.invoke("adminSettings", { action, ...extra });
      if (r.data?.key) setKey(r.data.key);
      await load();
      setMsg(action === "video_new_key" ? "Klucz gotowy. Pobierz pliki poniżej i wgraj je na serwer, potem włącz ochronę." : "Zapisano.");
    } catch (e) { setMsg(e?.response?.data?.error || "Nie udało się zapisać."); }
    setBusy("");
  };

  if (s === false) return null;
  return (
    <section className="border hairline p-6 md:p-8 space-y-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 gold-text mt-0.5 shrink-0" />
        <div>
          <h3 className="shop-heading text-2xl text-[#F5EFE1]">Ochrona filmów kursu</h3>
          <p className="text-sm text-foreground/60 mt-2 leading-relaxed max-w-3xl">
            Filmy z Twojego serwera dostają link ważny kilka godzin, podpisany kluczem. Skopiowany adres przestaje działać,
            a pliku nie da się otworzyć bez zalogowania się do kursu. Na filmie widać znak wodny z adresem e-mail kupującego.
            Pełnej blokady nagrania ekranu nie da żadna strona — znak wodny pozwala ustalić, kto udostępnił nagranie.
          </p>
        </div>
      </div>

      {!s ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={s.enabled ? "text-[#9FD3A0]" : "text-foreground/50"}>{s.enabled ? "Ochrona włączona" : "Ochrona wyłączona"}</span>
            <span className="text-foreground/40">{s.has_key ? `Klucz z ${new Date(s.key_created).toLocaleDateString("pl-PL")}` : "Brak klucza"}</span>
            <label className="flex items-center gap-2 text-foreground/70">Ważność linku
              <select value={s.ttl_h} onChange={(e) => act("video_save", { enabled: s.enabled, ttl_h: Number(e.target.value) })} className="bg-[#0A0A0B] border hairline px-2 py-1.5">
                {[2, 4, 6, 12, 24].map((h) => <option key={h} value={h}>{h} h</option>)}
              </select>
            </label>
          </div>

          <ol className="text-sm text-foreground/70 space-y-2 list-decimal pl-5 leading-relaxed">
            <li>Wygeneruj klucz (pokażę go tylko raz — od razu pobierz pliki).</li>
            <li>Na serwerze z filmami, w katalogu domeny (np. <code>wideo.exmortis.pl</code>): wgraj <code>stream.php</code> i <code>.htaccess</code>; utwórz katalog <code>_wideo</code>, wgraj do niego filmy i plik <code>.htaccess</code> z blokadą.</li>
            <li>W lekcji wpisz adres w formie <code>https://wideo.exmortis.pl/v/kurs/lekcja-1.mp4</code> (plik leży w <code>_wideo/kurs/lekcja-1.mp4</code>). Nazwy plików bez spacji i polskich znaków.</li>
            <li>Włącz ochronę i kliknij „Sprawdź odtwarzanie” przy lekcji.</li>
          </ol>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => act("video_new_key")} disabled={!!busy} className="btn-ghost !px-4 !py-2.5 text-[10px]">
              {busy === "video_new_key" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {s.has_key ? "NOWY KLUCZ" : "WYGENERUJ KLUCZ"}
            </button>
            {s.has_key && (
              <button type="button" onClick={() => act("video_save", { enabled: !s.enabled, ttl_h: s.ttl_h })} disabled={!!busy} className={s.enabled ? "btn-ghost !px-4 !py-2.5 text-[10px]" : "btn-relic !px-4 !py-2.5 text-[10px]"}>
                {s.enabled ? "WYŁĄCZ OCHRONĘ" : "WŁĄCZ OCHRONĘ"}
              </button>
            )}
          </div>
          {s.has_key && !key && <p className="text-xs text-foreground/45">Nowy klucz unieważnia poprzedni — po wygenerowaniu wgraj nowy stream.php.</p>}

          {key && (
            <div className="border border-[#C9A24A]/40 p-4 space-y-3">
              <p className="text-sm text-[#F5EFE1]">Pliki dla serwera (klucz jest już w środku stream.php):</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => save("stream.php", phpScript(key))} className="btn-relic !px-4 !py-2.5 text-[10px]"><Download className="h-4 w-4" /> STREAM.PHP</button>
                <button type="button" onClick={() => save("htaccess-katalog-domeny.txt", HTACCESS_ROOT)} className="btn-ghost !px-4 !py-2.5 text-[10px]"><Download className="h-4 w-4" /> .HTACCESS (DOMENA)</button>
                <button type="button" onClick={() => save("htaccess-katalog-_wideo.txt", HTACCESS_FILES)} className="btn-ghost !px-4 !py-2.5 text-[10px]"><Download className="h-4 w-4" /> .HTACCESS (_WIDEO)</button>
              </div>
              <p className="text-xs text-foreground/50">Pliki .txt po wgraniu zmień na nazwę <code>.htaccess</code>. Nie wysyłaj nikomu stream.php — zawiera klucz.</p>
            </div>
          )}
          {msg && <p className="text-sm gold-text">{msg}</p>}
        </>
      )}
    </section>
  );
}
