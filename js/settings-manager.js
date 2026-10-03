(() => {
  'use strict';
  const { CONFIG } = window.Lake;
  class SettingsManager {
    constructor(storage = window.localStorage) {
      this.storage = storage;
      this.defaults = { version: CONFIG.VERSION, volume: 0.65, muted: false, lastWorkDuration: 25 };
      this.listeners = new Set();
      this.warned = false;
      this.values = this.sanitize(this.read(CONFIG.SETTINGS_KEY));
    }
    sanitize(value) {
      if (!value || value.version !== CONFIG.VERSION) return { ...this.defaults };
      return {
        version: CONFIG.VERSION,
        volume: Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : this.defaults.volume,
        muted: typeof value.muted === 'boolean' ? value.muted : this.defaults.muted,
        lastWorkDuration: CONFIG.WORK_DURATIONS.includes(value.lastWorkDuration) ? value.lastWorkDuration : this.defaults.lastWorkDuration
      };
    }
    read(key) {
      try { return JSON.parse(this.storage?.getItem(key) || 'null'); }
      catch (error) { this.warn(error); return null; }
    }
    write(key, value) {
      try { this.storage?.setItem(key, JSON.stringify(value)); }
      catch (error) { this.warn(error); }
    }
    remove(key) {
      try { this.storage?.removeItem(key); }
      catch (error) { this.warn(error); }
    }
    warn(error) {
      if (this.warned) return;
      this.warned = true;
      console.warn('Сохранение недоступно; приложение продолжает работать.', error);
    }
    get(key) { return this.values[key]; }
    set(key, value) {
      if (!(key in this.defaults) || key === 'version') return;
      this.values = this.sanitize({ ...this.values, [key]: value });
      this.write(CONFIG.SETTINGS_KEY, this.values);
      this.listeners.forEach(callback => callback({ ...this.values }));
    }
    reset() {
      this.values = { ...this.defaults };
      this.write(CONFIG.SETTINGS_KEY, this.values);
      this.listeners.forEach(callback => callback({ ...this.values }));
    }
    subscribe(callback) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  }
  window.Lake.SettingsManager = SettingsManager;
})();
