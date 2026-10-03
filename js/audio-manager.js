(() => {
  'use strict';
  const { CONFIG } = window.Lake;
  class AudioManager {
    constructor({ volume = 0.65, muted = false } = {}) {
      this.volume = volume;
      this.muted = muted;
      this.unlocked = false;
      this.desired = null;
      this.frame = null;
      this.warned = new Set();
      this.gains = { work: 0, rest: 0, fishing: 0 };
      this.tracks = Object.fromEntries(Object.keys(this.gains).map(type => {
        const track = new Audio();
        track.loop = true;
        track.preload = 'none';
        track.volume = 0;
        track.addEventListener('error', () => this.warn(type));
        return [type, track];
      }));
    }
    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      if (this.desired) this.playTrack(this.desired, true);
    }
    warn(type, error) {
      if (this.warned.has(type)) return;
      this.warned.add(type);
      console.warn(`Музыка ${CONFIG.AUDIO_TRACKS[type]} недоступна; продолжаем без неё.`, error || '');
    }
    playTrack(type, force = false) {
      if (!Object.hasOwn(this.tracks, type)) return;
      const changed = this.desired !== type;
      this.desired = type;
      if (!this.unlocked || (!changed && !force)) return;
      const track = this.tracks[type];
      if (!track.getAttribute('src')) track.src = CONFIG.AUDIO_TRACKS[type];
      try {
        const play = track.play();
        play?.catch(error => {
          if (error.name === 'NotAllowedError') { this.unlocked = false; return; }
          if (error.name !== 'AbortError') this.warn(type, error);
        });
      } catch (error) { this.warn(type, error); }
      this.fadeTo(type);
    }
    fadeTo(type) {
      cancelAnimationFrame(this.frame);
      const initial = { ...this.gains };
      const started = performance.now();
      const animate = now => {
        const progress = Math.min(1, Math.max(0, (now - started) / CONFIG.MUSIC_FADE_DURATION));
        const eased = progress * progress * (3 - 2 * progress);
        for (const name of Object.keys(this.tracks)) {
          this.gains[name] = initial[name] + ((name === type ? 1 : 0) - initial[name]) * eased;
        }
        this.applyVolume();
        if (progress < 1) this.frame = requestAnimationFrame(animate);
        else {
          this.frame = null;
          for (const [name, track] of Object.entries(this.tracks)) {
            if (name !== type) { track.pause(); track.currentTime = 0; }
          }
        }
      };
      this.frame = requestAnimationFrame(animate);
    }
    stop() { this.desired = null; this.fadeTo(null); }
    applyVolume() {
      for (const [name, track] of Object.entries(this.tracks)) track.volume = this.muted ? 0 : this.volume * this.gains[name];
    }
    setVolume(value) { this.volume = Math.max(0, Math.min(1, value)); this.applyVolume(); }
    mute() { this.muted = true; this.applyVolume(); }
    unmute() { this.muted = false; this.applyVolume(); if (this.desired && this.unlocked) this.playTrack(this.desired, true); }
  }
  window.Lake.AudioManager = AudioManager;
})();
