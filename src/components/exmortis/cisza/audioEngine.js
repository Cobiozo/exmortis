// Silnik dźwięku ciszy — hybryda: element <audio> (strumieniowanie przez Range, gra przy zgaszonym ekranie)
// → MediaElementSource → GainNode (przenikania działają też na iPhonie) → głośność główna.
// Dwa tory: stary utwór cichnie, nowy wchodzi. Błąd pliku nigdy nie zatrzymuje minutnika.

const clamp = (v) => Math.max(0, Math.min(1, v));

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export class SilenceAudio {
  constructor({ volume = 0.6, muted = false, onError, onInterrupt } = {}) {
    this.vol = clamp(volume);
    this.muted = muted;
    this.onError = onError;
    this.onInterrupt = onInterrupt;
    this.items = new Set();
    this.mel = null;
    this.track = null;
    this.paused = false;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { this.ctx = AC ? new AC() : null; } catch { this.ctx = null; }
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this._wake = () => { if (this.ctx.state !== "running" && !this.paused) this.ctx.resume().catch(() => {}); };
      document.addEventListener("visibilitychange", this._wake);
      this.ctx.onstatechange = this._wake;
    }
    this._master();
    this.watch = setInterval(() => this._tick(), 200);
  }

  _master() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.05);
    else this.items.forEach((i) => this._applyEl(i));
  }

  _applyEl(it) {
    if (it.node) return;
    it.a.volume = clamp(it.level * it.k * this.vol);
    it.a.muted = this.muted;
  }

  setVolume(v) { this.vol = clamp(v); this._master(); }
  setMuted(m) { this.muted = m; this._master(); }

  _make(url, k = 1, preload = "auto") {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = preload;
    a.src = url;
    const it = { a, k, level: 0, timer: null, node: null };
    if (this.ctx) {
      try {
        it.node = this.ctx.createGain();
        it.node.gain.value = 0;
        this.ctx.createMediaElementSource(a).connect(it.node);
        it.node.connect(this.master);
      } catch { it.node = null; }
    }
    a.addEventListener("error", () => { if (this.items.has(it)) this.onError?.(); });
    this.items.add(it);
    this._applyEl(it);
    return it;
  }

  _fade(it, to, ms, done) {
    clearInterval(it.timer);
    clearTimeout(it.doneT);
    if (it.node) {
      const g = it.node.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      if (ms) g.linearRampToValueAtTime(to * it.k, now + ms / 1000);
      else g.setValueAtTime(to * it.k, now);
      it.level = to;
      if (done) it.doneT = setTimeout(done, ms);
      return;
    }
    const from = it.level;
    const t0 = performance.now();
    const step = () => {
      const p = ms ? Math.min(1, (performance.now() - t0) / ms) : 1;
      it.level = from + (to - from) * p;
      this._applyEl(it);
      if (p >= 1) { clearInterval(it.timer); done?.(); }
    };
    if (!ms) return step();
    it.timer = setInterval(step, 50);
  }

  _kill(it) {
    clearInterval(it.timer);
    clearTimeout(it.doneT);
    it.dying = true;
    it.a.pause();
    it.a.removeAttribute("src");
    it.a.load();
    try { it.node?.disconnect(); } catch { /* już odłączony */ }
    this.items.delete(it);
  }

  _play(it) {
    if (this.paused) return;
    this.ctx?.resume().catch(() => {});
    it.a.play().catch(() => {});
  }

  // Wstęp / zakończenie: gra raz, obiecuje zakończenie (także przy błędzie).
  playOnce(url, k = 1) {
    return new Promise((resolve) => {
      const it = this._make(url, k);
      this._fade(it, 1, 0);
      let finished = false;
      const fin = () => {
        if (finished) return;
        finished = true;
        clearTimeout(cap);
        this._kill(it);
        resolve();
      };
      const cap = setTimeout(fin, 60000);
      it.a.addEventListener("ended", fin);
      it.a.addEventListener("error", fin);
      this.ctx?.resume().catch(() => {});
      it.a.play().catch(fin);
    });
  }

  // track = { url, k, loop, xfade, next() } — pobierany tylko fragment od miejsca startu.
  startMelody(track, offsetS = 0, fadeMs = 3000) {
    this.track = track;
    const it = this._make(`${track.url}#t=${Math.floor(offsetS)}`, track.k, "metadata");
    it.a.addEventListener("loadedmetadata", () => {
      const d = it.a.duration;
      if (offsetS > 0 && isFinite(d) && d > 0) it.a.currentTime = Math.min(offsetS, d - 0.5);
    }, { once: true });
    it.a.addEventListener("ended", () => {
      // Zapas na uśpione timery: pętla bez przenikania.
      if (this.mel === it && track.loop) { it.a.currentTime = 0; this._play(it); }
    });
    // System zatrzymał dźwięk (np. rozłączone słuchawki).
    it.a.addEventListener("pause", () => {
      if (this.mel === it && !this.paused && !it.dying && !it.a.ended) this.onInterrupt?.();
    });
    this.mel = it;
    this._play(it);
    this._fade(it, 1, fadeMs);
  }

  _tick() {
    const it = this.mel;
    const t = this.track;
    if (!it || !t || this.paused || it.handing) return;
    const d = it.a.duration;
    if (!isFinite(d) || d <= 0) return;
    const x = Math.min(t.xfade, d / 4);
    if (it.a.currentTime < d - x) return;
    const next = t.loop ? t : t.next?.();
    if (!next) return;
    it.handing = true;
    this.switchMelody(next, 0, x * 1000);
  }

  switchMelody(track, offsetS, ms = 3000) {
    this.stopMelody(ms);
    this.startMelody(track, offsetS, ms);
  }

  stopMelody(ms = 2000) {
    const it = this.mel;
    this.mel = null;
    this.track = null;
    if (it) { it.dying = true; this._fade(it, 0, ms, () => this._kill(it)); }
  }

  pauseAll() {
    this.paused = true;
    this.items.forEach((i) => i.a.pause());
  }

  resumeAll() {
    this.paused = false;
    this.ctx?.resume().catch(() => {});
    this.items.forEach((i) => { if (i.level > 0) i.a.play().catch(() => {}); });
  }

  stopAll(ms = 0) {
    this.mel = null;
    this.track = null;
    [...this.items].forEach((i) => { i.dying = true; this._fade(i, 0, ms, () => this._kill(i)); });
    if (!ms) {
      clearInterval(this.watch);
      if (this.ctx) {
        document.removeEventListener("visibilitychange", this._wake);
        this.ctx.onstatechange = null;
        this.ctx.close().catch(() => {});
      }
    }
  }
}