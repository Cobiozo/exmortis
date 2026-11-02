// JEDYNE miejsce z adresami Spotify: muzyka → profil artysty, podcast → audycja.
// Adres „strona główna” i wyszukiwanie nie prowadzą do materiału, więc je podmieniamy.
export const SPOTIFY_ARTIST = "https://open.spotify.com/artist/64ZkuPyMDXiDBkWmbBZpGW";
export const SPOTIFY_SHOW = "https://open.spotify.com/show/74P4ITuHxNfJSArFqIDJjF";

const CONTENT = /open\.spotify\.com\/(artist|show|album|track|playlist|episode)\//i;

// kind: "artist" (muzyka) albo "show" (podcast).
export function canonSpotify(url, kind = "show") {
  const u = String(url || "").trim();
  if (CONTENT.test(u)) return u.split("?")[0];
  return kind === "artist" ? SPOTIFY_ARTIST : SPOTIFY_SHOW;
}