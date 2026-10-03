(() => {
  'use strict';
  const { CONFIG } = window.Lake;
  class FishingManager {
    constructor({ now = () => Date.now(), random = () => Math.random(), onBite = () => {}, onCatch = () => {}, onMiss = () => {} } = {}) {
      this.now = now;
      this.random = random;
      this.onBite = onBite;
      this.onCatch = onCatch;
      this.onMiss = onMiss;
      this.phase = 'idle';
      this.task = null;
    }
    beginWait() {
      this.reset();
      this.phase = 'wait';
      this.waitDeadline = this.now() + CONFIG.FISHING_BITE_MIN + Math.round(this.random() * (CONFIG.FISHING_BITE_MAX - CONFIG.FISHING_BITE_MIN));
      this.task = setTimeout(() => this.check(), Math.max(0, this.waitDeadline - this.now()));
    }
    beginBite(deadline) {
      clearTimeout(this.task);
      this.phase = 'bite';
      this.reactionDeadline = deadline;
      this.task = setTimeout(() => this.check(), Math.max(0, deadline - this.now()));
      this.check();
    }
    check() {
      if (this.phase === 'wait' && this.now() >= this.waitDeadline) {
        this.phase = 'bite';
        this.onBite(this.waitDeadline + CONFIG.FISHING_REACTION_TIME);
      } else if (this.phase === 'bite' && this.now() >= this.reactionDeadline) {
        this.reset();
        this.onMiss();
      }
    }
    hook() {
      if (this.phase !== 'bite') return false;
      if (this.now() >= this.reactionDeadline) { this.check(); return false; }
      this.reset();
      this.onCatch();
      return true;
    }
    reset() { clearTimeout(this.task); this.task = null; this.phase = 'idle'; }
  }
  window.Lake.FishingManager = FishingManager;
})();
