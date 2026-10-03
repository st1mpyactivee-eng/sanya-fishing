(() => {
  'use strict';
  const { STATES, TRANSITIONS } = window.Lake;
  const overlays = new Set([STATES.SETTINGS, STATES.ABOUT]);
  class StateManager {
    constructor() {
      this.current = null;
      this.underlay = null;
      this.handlers = new Map();
      this.listeners = new Set();
      this.tasks = new Set();
      this.epoch = 0;
    }
    get activeState() { return this.underlay || this.current; }
    get hasOverlay() { return overlays.has(this.current); }
    register(name, handlers) { this.handlers.set(name, handlers); }
    subscribe(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
    notify() { this.listeners.forEach(callback => callback(this.current, this.activeState)); }
    transition(next, payload = {}) {
      if (!Object.hasOwn(STATES, next)) return false;
      if (overlays.has(next)) return this.openOverlay(next);
      const previous = this.activeState;
      if (next === previous) return false;
      // Restoration is permitted only before the initial state has been entered.
      if (previous && !TRANSITIONS[previous]?.includes(next)) return false;
      if (this.hasOverlay) this.closeOverlay();
      this.cancelTasks();
      this.handlers.get(previous)?.exit?.(next);
      this.epoch += 1;
      this.current = next;
      this.underlay = null;
      this.handlers.get(next)?.enter?.(payload, previous);
      this.notify();
      return true;
    }
    openOverlay(next) {
      if (!this.current || this.hasOverlay) return false;
      this.underlay = this.current;
      this.current = next;
      this.handlers.get(next)?.enter?.();
      this.notify();
      return true;
    }
    closeOverlay() {
      if (!this.hasOverlay) return false;
      const overlay = this.current;
      this.current = this.underlay;
      this.underlay = null;
      this.handlers.get(overlay)?.exit?.();
      this.notify();
      return true;
    }
    schedule(callback, delay) {
      const epoch = this.epoch;
      const task = setTimeout(() => {
        this.tasks.delete(task);
        if (epoch === this.epoch) callback();
      }, delay);
      this.tasks.add(task);
      return task;
    }
    cancelTasks() { this.tasks.forEach(clearTimeout); this.tasks.clear(); }
  }
  window.Lake.StateManager = StateManager;
})();
