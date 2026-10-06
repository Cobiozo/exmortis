// Silnik dźwięku Minutnika ciszy — zwykłe elementy <audio> (grają przy zgaszonym ekranie).
// Głośność = wzmocnienie elementu (fade) × głośność główna. Błąd pliku nigdy nie zatrzymuje minutnika.

const clamp = (v) => Math.max(0, Math.min(1, v));

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export class SilenceAudio {
  constructor({ volume = 0.6, muted = false, onError } = {}) {
    this.vol = clamp(volume);
    this.muted = muted;
    this.onError = onError;
    this.items = new Set();
    this.mel = null;
    this.paused = false;
    this.loopTimer = null;
  }

  _make(url, preload = "auto") {
    const a = new Audio();
    a.preload = preload;
    a.src = url;
    const it = { a, gain: 0, timer: null };
    a.addEventListener("error", () => this.onError?.());
    this.items.add(it);
    this._apply(it);
    return it;
  }

  _apply(it) {
    it.a.volume = clamp(it.gain * this.vol);
    it.a.muted = this.muted;
  }

  setVolume(v) {
    this.vol = clamp(v);
    this.items.forEach((i) => this._apply(i));
  }

  setMuted(m) {
    this.muted = m;
    this.items.forEach((i) => this._apply(i));
  }

  _fade(it, to, ms, done) {
    clearInterval(it.timer);
    if (!ms) {
      it.gain = to;
      this._apply(it);
      done?.();
      return;
    }
    const from = it.gain;
    const t0 = performance.now();
    it.timer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      it.gain = from + (to - from) * k;
      this._apply(it);
      if (k >= 1) {
        clearInterval(it.timer);
        done?.();
      }
    }, 50);
  }

  _kill(it) {
    clearInterval(it.timer);
    it.a.pause();
    it.a.removeAttribute("src");
    it.a.load();
    this.items.delete(it);
  }

  _play(it) {
    if (!this.paused) it.a.play().catch(() => {});
  }

  // Wstęp / zakończenie: gra raz, obiecuje zakończenie (także przy błędzie).
  playOnce(url) {
    return new Promise((resolve) => {
      const it = this._make(url);
      it.gain = 1;
      this._apply(it);
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
      it.a.play().catch(fin);
    });
  }

  startMelody(url, loop, offsetS = 0, fadeMs = 3000) {
    this.melUrl = url;
    this.loop = loop;
    this.fadeMs = fadeMs;
    const it = this._make(url, "none");
    if (offsetS > 0) {
      it.a.addEventListener(
        "loadedmetadata",
        () => {
          const d = it.a.duration;
          if (isFinite(d) && d > 0) it.a.currentTime = loop ? offsetS % d : Math.min(offsetS, d);
        },
        { once: true }
      );
    }
    it.a.addEventListener("ended", () => {
      // Zapas na wypadek uśpionych timerów: pętla bez przenikania.
      if (this.loop && this.mel === it) {
        it.a.currentTime = 0;
        this._play(it);
      }
    });
    this.mel = it;
    this._play(it);
    this._fade(it, 1, fadeMs);
    this._watch();
  }

  _watch() {
    clearInterval(this.loopTimer);
    this.loopTimer = setInterval(() => {
      const it = this.mel;
      if (!it || !this.loop || this.paused) return;
      const d = it.a.duration;
      if (!isFinite(d) || d <= 0) return;
      const x = Math.max(0.3, Math.min((this.fadeMs || 0) / 1000 || 1, d / 4));
      if (it.a.currentTime >= d - x) {
        const url = this.melUrl;
        this.mel = null;
        this._fade(it, 0, x * 1000, () => this._kill(it));
        const next = this._make(url);
        next.a.addEventListener("ended", () => {
          if (this.loop && this.mel === next) {
            next.a.currentTime = 0;
            this._play(next);
          }
        });
        this.mel = next;
        this._play(next);
        this._fade(next, 1, x * 1000);
      }
    }, 200);
  }

  stopMelody(ms = 2000) {
    const it = this.mel;
    this.mel = null;
    clearInterval(this.loopTimer);
    if (it) this._fade(it, 0, ms, () => this._kill(it));
  }

  switchMelody(url, loop, offsetS, ms = 2000) {
    this.stopMelody(ms);
    this.startMelody(url, loop, offsetS, ms);
  }

  pauseAll() {
    this.paused = true;
    this.items.forEach((i) => i.a.pause());
  }

  resumeAll() {
    this.paused = false;
    this.items.forEach((i) => {
      if (i.gain > 0) i.a.play().catch(() => {});
    });
  }

  stopAll(ms = 0) {
    clearInterval(this.loopTimer);
    this.mel = null;
    [...this.items].forEach((i) => this._fade(i, 0, ms, () => this._kill(i)));
  }
}