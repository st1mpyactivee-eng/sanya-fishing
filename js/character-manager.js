(() => {
  'use strict';
  const { CONFIG, CHARACTER_STATES, CHARACTER_GROUPS } = window.Lake;
  class CharacterManager {
    constructor(element, { random = Math.random } = {}) {
      this.element = element;
      this.frames = [...element.querySelectorAll('.character-frame')];
      this.fallback = element.querySelector('.character-fallback');
      this.cache = new Map();
      this.front = 0;
      this.request = 0;
      this.cycleTask = null;
      this.cycleEpoch = 0;
      this.random = random;
      this.fadeDone = Promise.resolve();
      this.sceneChange = false;
      document.documentElement.style.setProperty('--character-transition', `${CONFIG.CHARACTER_TRANSITION}ms`);
    }
    loadSource(src) {
      return new Promise(resolve => {
        const image = new Image();
        let settled = false;
        const finish = value => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          image.onload = image.onerror = null;
          resolve(value);
        };
        const timeout = setTimeout(() => finish(null), CONFIG.PRELOAD_TIMEOUT);
        image.onload = async () => {
          try { await image.decode(); finish(image.src); } catch { finish(null); }
        };
        image.onerror = () => finish(null);
        image.src = src;
      });
    }
    load(pose) {
      const spec = CHARACTER_STATES[pose];
      if (!spec) return Promise.resolve(null);
      if (this.cache.has(pose)) return this.cache.get(pose);
      const promise = (async () => {
        const source = await this.loadSource(spec.src) || await this.loadSource(spec.fallbackSrc);
        if (!source) this.cache.delete(pose);
        return source;
      })();
      this.cache.set(pose, promise);
      return promise;
    }
    preload(poses) { return Promise.all([...new Set(poses)].map(pose => this.load(pose))); }
    preloadGroup(group) { return this.preload(CHARACTER_GROUPS[group] || []); }
    moveToScene(scene, mode) {
      if (scene.dataset.mode === mode) return;
      const parent = this.element.getBoundingClientRect();
      // Keep both buffers at their current on-screen size while the scene adopts its new layout.
      // The anchors and micro-motions remain attached to those original dimensions.
      const layouts = this.frames.map(frame => {
        const style = getComputedStyle(frame);
        return {
          left: parent.left + parseFloat(style.left), top: parent.top + parseFloat(style.top),
          width: style.width, height: style.height
        };
      });
      scene.dataset.mode = mode;
      const target = this.element.getBoundingClientRect();
      this.frames.forEach((frame, index) => {
        const layout = layouts[index];
        frame.style.left = `${layout.left - target.left}px`;
        frame.style.top = `${layout.top - target.top}px`;
        frame.style.width = layout.width;
        frame.style.height = layout.height;
      });
      this.sceneChange = this.frames.some(frame => frame.classList.contains('active') && frame.naturalWidth);
      this.element.dataset.sceneChanging = String(this.sceneChange);
    }
    async setState(pose) {
      const spec = CHARACTER_STATES[pose];
      if (!spec) return false;
      const request = ++this.request;
      const source = await this.load(pose);
      await this.fadeDone;
      if (request !== this.request) return false;
      if (!source) {
        if (!this.frames[this.front].naturalWidth) this.fallback.hidden = false;
        this.sceneChange = false;
        delete this.element.dataset.sceneChanging;
        return false;
      }
      if (this.element.dataset.pose === pose && !this.sceneChange) return true;
      const next = 1 - this.front;
      const frame = this.frames[next];
      frame.src = source;
      try { await frame.decode(); } catch {
        if (request === this.request) {
          if (!this.frames[this.front].naturalWidth) this.fallback.hidden = false;
          this.sceneChange = false;
          delete this.element.dataset.sceneChanging;
        }
        return false;
      }
      if (request !== this.request) return false;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const changingScene = this.sceneChange;
      const duration = reducedMotion ? 120 :
        pose === 'fishing-bite' ? 280 : CONFIG.CHARACTER_TRANSITION;
      const fadeOut = changingScene ? reducedMotion ? 0 : CONFIG.CHARACTER_SCENE_FADE_OUT : duration;
      const fadeIn = changingScene ? reducedMotion ? 120 : CONFIG.CHARACTER_SCENE_FADE_IN : duration;
      ['left', 'top', 'width', 'height'].forEach(property => frame.style.removeProperty(property));
      this.element.style.setProperty('--character-transition', `${duration}ms`);
      frame.style.transitionDuration = `${fadeIn}ms`;
      frame.style.transitionDelay = changingScene ? `${fadeOut}ms` : '0ms';
      this.frames[this.front].style.transitionDuration = `${fadeOut}ms`;
      this.frames[this.front].style.transitionDelay = '0ms';
      frame.dataset.anchor = spec.anchor;
      frame.className = `character-frame character-layer-${next ? 'b' : 'a'} character--${spec.motion}`;
      void frame.offsetWidth;
      frame.classList.add('active');
      this.frames[this.front].classList.remove('active');
      this.front = next;
      this.element.dataset.pose = pose;
      this.element.dataset.anchor = spec.anchor;
      this.fallback.hidden = true;
      this.sceneChange = false;
      this.fadeDone = new Promise(resolve => setTimeout(() => {
        if (request === this.request) delete this.element.dataset.sceneChanging;
        resolve();
      }, changingScene ? fadeOut + fadeIn : duration));
      return true;
    }
    async startCycle(sequence) {
      this.stopCycle();
      const epoch = this.cycleEpoch;
      await this.preload(sequence.map(item => item.pose));
      if (epoch !== this.cycleEpoch) return;
      let index = 0;
      const advance = async () => {
        if (epoch !== this.cycleEpoch) return;
        const item = sequence[index];
        await this.setState(item.pose);
        if (epoch !== this.cycleEpoch) return;
        index = (index + 1) % sequence.length;
        const varied = Math.round(item.duration * (.9 + this.random() * .2));
        const duration = item.pose.startsWith('rest-') ? Math.max(15000, Math.min(40000, varied)) : varied;
        this.cycleTask = setTimeout(advance, duration);
      };
      advance();
    }
    stopCycle() {
      clearTimeout(this.cycleTask);
      this.cycleTask = null;
      this.cycleEpoch += 1;
      this.request += 1;
    }
  }
  window.Lake.CharacterManager = CharacterManager;
})();
