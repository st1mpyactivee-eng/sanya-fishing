(() => {
  'use strict';
  const { CONFIG } = window.Lake;
  class TimerManager {
    constructor(settings, { now = () => Date.now(), onTick = () => {}, onComplete = () => {} } = {}) {
      this.settings = settings;
      this.now = now;
      this.onTick = onTick;
      this.onComplete = onComplete;
      this.kind = null;
      this.endTime = null;
      this.totalMs = 0;
      this.remainingMs = 0;
      this.paused = false;
      this.interval = null;
      this.generation = 0;
    }
    start(kind, durationSeconds, { endTime, selectedWorkDuration } = {}) {
      this.stop(false);
      this.kind = kind;
      this.totalMs = durationSeconds * 1000;
      this.endTime = endTime ?? this.now() + this.totalMs;
      this.selectedWorkDuration = selectedWorkDuration || this.settings.get('lastWorkDuration');
      this.paused = false;
      this.save();
      this.interval = setInterval(() => this.tick(), CONFIG.TIMER_TICK_INTERVAL);
      this.tick();
    }
    tick() {
      if (!this.kind) return;
      if (!this.paused) this.remainingMs = Math.max(0, this.endTime - this.now());
      this.onTick(this.snapshot());
      if (!this.paused && this.remainingMs === 0) {
        clearInterval(this.interval);
        this.interval = null;
        const completed = { kind: this.kind, endTime: this.endTime };
        this.kind = null;
        this.settings.remove(CONFIG.TIMER_KEY);
        const generation = this.generation;
        // Completion can occur during restoration. Finish after the state's enter hook.
        queueMicrotask(() => { if (generation === this.generation) this.onComplete(completed); });
      }
    }
    pause() {
      if (!this.kind || this.paused) return;
      this.tick();
      if (!this.kind) return;
      this.paused = true;
      clearInterval(this.interval);
      this.interval = null;
      this.save();
      this.onTick(this.snapshot());
    }
    resume() {
      if (!this.kind || !this.paused) return;
      this.paused = false;
      this.endTime = this.now() + this.remainingMs;
      this.save();
      this.interval = setInterval(() => this.tick(), CONFIG.TIMER_TICK_INTERVAL);
      this.tick();
    }
    loadPaused(session) {
      this.stop(false);
      this.kind = 'work';
      this.totalMs = session.totalMs;
      this.remainingMs = session.remainingMs;
      this.selectedWorkDuration = session.selectedWorkDuration;
      this.endTime = null;
      this.paused = true;
      this.onTick(this.snapshot());
    }
    snapshot() { return { kind: this.kind, remainingMs: this.remainingMs, totalMs: this.totalMs, paused: this.paused }; }
    save() {
      if (!this.kind) return;
      this.settings.write(CONFIG.TIMER_KEY, {
        version: CONFIG.VERSION,
        timerState: this.kind === 'rest' ? 'REST' : this.paused ? 'WORK_PAUSED' : 'WORK',
        timerEndTime: this.endTime,
        remainingMs: this.paused ? this.remainingMs : Math.max(0, this.endTime - this.now()),
        totalMs: this.totalMs,
        selectedWorkDuration: this.selectedWorkDuration
      });
    }
    restore() {
      const session = this.settings.read(CONFIG.TIMER_KEY);
      if (!session) return null;
      const valid = session.version === CONFIG.VERSION &&
        ['WORK', 'WORK_PAUSED', 'REST'].includes(session.timerState) &&
        Number.isFinite(session.totalMs) && session.totalMs > 0 && session.totalMs <= 60 * 60 * 1000 &&
        CONFIG.WORK_DURATIONS.includes(session.selectedWorkDuration) &&
        (session.timerState === 'WORK_PAUSED'
          ? Number.isFinite(session.remainingMs) && session.remainingMs > 0 && session.remainingMs <= session.totalMs
          : Number.isFinite(session.timerEndTime) && session.timerEndTime > 0 && session.timerEndTime <= this.now() + session.totalMs);
      if (!valid) { this.settings.remove(CONFIG.TIMER_KEY); return null; }
      return session;
    }
    stop(clearSaved = true) {
      clearInterval(this.interval);
      this.interval = null;
      this.kind = null;
      this.paused = false;
      this.generation += 1;
      if (clearSaved) this.settings.remove(CONFIG.TIMER_KEY);
    }
    static format(milliseconds) {
      const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
      return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }
  window.Lake.TimerManager = TimerManager;
})();
