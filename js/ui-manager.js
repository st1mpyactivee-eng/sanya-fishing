(() => {
  'use strict';
  const { CONFIG, STATES: S, TimerManager, FishingStoryManager } = window.Lake;
  const modeMessages = {
    WORK: ['Пока вы работаете, берег живёт своим ритмом', 'Одна задача. Немного внимания. Всё остальное подождёт.'],
    WORK_PAUSED: ['Можно выдохнуть', 'Таймер на паузе. Продолжайте, когда будете готовы.'],
    REST: ['Пять минут просто для себя', 'Отложите дела. Посмотрите на воду. Побудьте здесь.'],
    FISHING_IDLE: ['Хороший день, чтобы никуда не спешить', 'Закиньте удочку. Всё остальное сделает озеро.'],
    FISHING_CAST: ['Пусть мысли уплывают', 'Удочка отправляется в воду.'],
    FISHING_WAIT: ['Только вы, вода и немного тишины', 'Поплавок качается. Можно просто смотреть.'],
    FISHING_BITE: ['Кажется, клюёт!', 'Самое время спокойно подсечь.'],
    FISHING_CATCH: ['Вот и маленькая встреча', 'Полюбуемся рыбой и отпустим её обратно.'],
    FISHING_MISSED: ['Сорвалась. Ничего, попробуем ещё.', 'Озеро никуда не спешит. И нам не нужно.']
  };
  const characterMessages = {
    FISHING_IDLE: ['Ну что, закинем?', 'У озера времени много. Можно просто посидеть.'],
    FISHING_CAST: ['Отправляем удочку в воду.', 'Сейчас устроимся поудобнее.'],
    FISHING_WAIT: ['Тихо… ждём.', 'Поплавок покачивается. Можно не спешить.'],
    FISHING_BITE: ['Клюёт! Подсекай!', 'Кажется, кто-то на том конце лески.'],
    FISHING_CATCH: ['Вот она, красавица!', 'Полюбуемся и отпустим обратно в озеро.'],
    FISHING_MISSED: ['Сорвалась. Бывает.', 'Ничего страшного. Закинем ещё, когда захотите.']
  };
  class UIManager {
    constructor(onAction) {
      this.onAction = onAction;
      this.scene = document.getElementById('scene');
      this.elements = Object.fromEntries([
        'menu-panel', 'setup-panel', 'rest-panel', 'mode-controls', 'timer', 'timer-kind', 'timer-value',
        'timer-note', 'timer-progress', 'mode-title', 'mode-description', 'pause-button', 'resume-button',
        'reset-button', 'fishing-button', 'control-divider', 'footer-text', 'music-button', 'music-toggle',
        'volume-slider', 'volume-output', 'fullscreen-button', 'settings-fullscreen', 'start-work',
        'settings-modal', 'about-modal', 'confirm-modal', 'toast', 'loader', 'fishing-water',
        'mode-message', 'character-interact', 'character-hint', 'character-dialog',
        'character-dialog-title', 'character-dialog-description'
      ].map(id => [id, document.getElementById(id)]));
      this.lastState = null;
      this.toastTask = null;
      this.characterState = null;
      this.characterDialogOpen = false;
      this.overlay = false;
      this.stories = new FishingStoryManager({ onStory: () => {
        this.updateCharacterMessage();
        this.positionCharacterDialog();
      } });
      document.addEventListener('visibilitychange', () => this.updateCharacterDialog());
      document.addEventListener('click', event => {
        if (this.characterDialogOpen && !event.target.closest('#character, #character-dialog, dialog')) {
          this.closeCharacterDialog();
        }
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.dataset.duration) this.onAction('duration', Number(button.dataset.duration));
        else if (button.dataset.action) this.onAction(button.dataset.action);
      });
      this.elements['volume-slider'].addEventListener('input', event => this.onAction('volume', Number(event.target.value) / 100));
      this.elements['music-toggle'].addEventListener('change', event => this.onAction('set-muted', !event.target.checked));
      ['settings-modal', 'about-modal', 'confirm-modal'].forEach(id => {
        const dialog = this.elements[id];
        dialog.addEventListener('cancel', event => {
          event.preventDefault();
          this.onAction(id === 'confirm-modal' ? 'cancel-reset' : 'close-modal');
        });
        dialog.addEventListener('click', event => {
          if (event.target !== dialog) return;
          const box = dialog.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
            this.onAction(id === 'confirm-modal' ? 'cancel-reset' : 'close-modal');
          }
        });
      });
      document.addEventListener('fullscreenchange', () => this.updateFullscreen());
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.characterDialogOpen && !document.querySelector('dialog[open]')) {
          event.preventDefault();
          this.closeCharacterDialog(true);
          return;
        }
        if (event.key === 'Escape' && document.fullscreenElement && !document.querySelector('dialog[open]')) {
          event.preventDefault();
          this.toggleFullscreen();
        }
      });
      const reposition = () => this.positionCharacterDialog();
      window.addEventListener('resize', reposition);
      document.getElementById('character').addEventListener('transitionend', reposition);
      if (window.ResizeObserver) {
        this.dialogResizeObserver = new ResizeObserver(reposition);
        this.dialogResizeObserver.observe(this.scene);
        this.dialogResizeObserver.observe(this.elements['character-dialog']);
      }
      document.querySelectorAll('.optional-image').forEach(image => {
        image.addEventListener('error', () => { image.hidden = true; });
        if (image.complete && !image.naturalWidth) image.hidden = true;
      });
      this.updateFullscreen();
    }
    render(state, { restComplete = false, overlay = false } = {}) {
      const e = this.elements;
      e['menu-panel'].hidden = state !== S.MENU;
      e['setup-panel'].hidden = state !== S.WORK_SETUP;
      e['rest-panel'].hidden = !(state === S.REST && restComplete);
      const work = [S.WORK, S.WORK_PAUSED].includes(state);
      const fishing = state.startsWith('FISHING_');
      this.overlay = overlay;
      this.characterState = fishing ? state : null;
      if (state === S.FISHING_WAIT && this.lastState !== state) this.stories.begin();
      else if (state !== S.FISHING_WAIT) this.stories.stop();
      e['character-interact'].hidden = !fishing;
      e['mode-message'].hidden = fishing;
      if (!fishing || !this.lastState?.startsWith('FISHING_')) this.characterDialogOpen = false;
      if ([S.FISHING_BITE, S.FISHING_CATCH, S.FISHING_MISSED].includes(state) && this.lastState !== state) this.characterDialogOpen = true;
      if (fishing) {
        this.updateCharacterMessage();
        const action = state === S.FISHING_IDLE ? 'закинуть удочку' : state === S.FISHING_BITE ? 'подсечь рыбу' : 'поговорить';
        e['character-interact'].setAttribute('aria-label', `Саня: ${action}`);
        e['character-hint'].textContent = state === S.FISHING_IDLE ? 'Закинуть удочку · нажмите на Саню' : state === S.FISHING_BITE ? 'Подсечь · нажмите на Саню' : 'Поговорить с Саней';
      }
      e['timer'].hidden = !(work || (state === S.REST && !restComplete));
      e['mode-controls'].hidden = !(work || fishing || (state === S.REST && !restComplete));
      e['pause-button'].hidden = state !== S.WORK;
      e['resume-button'].hidden = state !== S.WORK_PAUSED;
      e['reset-button'].hidden = !work;
      e['control-divider'].hidden = !work;
      e['fishing-button'].hidden = ![S.FISHING_IDLE, S.FISHING_BITE].includes(state);
      e['fishing-button'].dataset.action = state === S.FISHING_BITE ? 'hook' : 'cast';
      e['fishing-button'].innerHTML = `${state === S.FISHING_BITE ? 'Подсечь!' : 'Закинуть удочку'}<svg><use href="#i-fish"/></svg>`;
      e['fishing-water'].hidden = ![S.FISHING_WAIT, S.FISHING_BITE].includes(state);
      this.scene.dataset.bite = String(state === S.FISHING_BITE);
      const message = modeMessages[state];
      if (message) { e['mode-title'].textContent = message[0]; e['mode-description'].textContent = message[1]; }
      e['footer-text'].textContent = fishing ? 'Нажмите на Саню, чтобы закинуть удочку или подсечь.' : 'Место, где можно никуда не спешить';
      this.updateCharacterDialog();
      if (this.lastState !== state && !overlay) {
        const focus = {
          MENU: 'menu-title', WORK_SETUP: 'setup-title', FISHING_IDLE: 'character-interact',
          FISHING_BITE: 'fishing-button', FISHING_CATCH: 'character-interact',
          FISHING_MISSED: 'character-interact', WORK: 'pause-button', WORK_PAUSED: 'resume-button'
        }[state] || (state === S.REST && restComplete ? 'rest-title' : null);
        if (focus) {
          const target = document.getElementById(focus);
          if (!target.matches('button')) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
      this.lastState = state;
    }
    updateCharacterDialog() {
      const visible = Boolean(this.characterState && this.characterDialogOpen && !this.overlay);
      this.elements['character-dialog'].hidden = !visible;
      this.elements['character-interact'].setAttribute('aria-expanded', String(visible));
      this.elements['character-hint'].hidden = !this.characterState || visible;
      if (visible && this.characterState === S.FISHING_WAIT && !document.hidden) this.stories.resume();
      else this.stories.pause();
      if (visible) this.positionCharacterDialog();
    }
    updateCharacterMessage() {
      if (!this.characterState) return;
      const story = this.characterState === S.FISHING_WAIT ? this.stories.current : null;
      const message = story ? [story.title, story.text] : characterMessages[this.characterState];
      this.elements['character-dialog-title'].textContent = message[0];
      this.elements['character-dialog-description'].textContent = message[1];
    }
    openCharacterDialog() {
      if (!this.characterState) return;
      this.characterDialogOpen = true;
      this.updateCharacterDialog();
    }
    closeCharacterDialog(returnFocus = false) {
      this.characterDialogOpen = false;
      this.updateCharacterDialog();
      if (returnFocus && this.characterState) this.elements['character-interact'].focus({ preventScroll: true });
    }
    toggleCharacterDialog() {
      if (this.characterDialogOpen) this.closeCharacterDialog();
      else this.openCharacterDialog();
    }
    positionCharacterDialog() {
      const dialog = this.elements['character-dialog'];
      if (dialog.hidden) return;
      const scene = this.scene.getBoundingClientRect();
      const character = this.elements['character-interact'].getBoundingClientRect();
      const width = dialog.offsetWidth;
      const height = dialog.offsetHeight;
      const margin = 20;
      const gap = 16;
      let left = character.left - scene.left - width - gap;
      let top = character.top - scene.top + 8;
      let placement = 'left';
      if (left < margin) {
        left = character.right - scene.left + gap;
        placement = 'right';
        if (left + width > scene.width - margin) {
          left = (character.left + character.right) / 2 - scene.left - width * .7;
          top = character.top - scene.top - height - gap;
          placement = 'above';
        }
      }
      left = Math.max(margin, Math.min(left, scene.width - width - margin));
      top = Math.max(margin, Math.min(top, scene.height - height - margin));
      dialog.dataset.placement = placement;
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
    }
    selectDuration(minutes) {
      document.querySelectorAll('[data-duration]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.duration) === minutes)));
      this.elements['start-work'].disabled = !CONFIG.WORK_DURATIONS.includes(minutes);
    }
    updateTimer({ kind, remainingMs, totalMs, paused }) {
      this.elements['timer-value'].textContent = TimerManager.format(remainingMs);
      this.elements['timer-kind'].textContent = kind === 'rest' ? 'Отдых' : paused ? 'Работа · пауза' : 'Работа';
      this.elements['timer-note'].textContent = kind === 'rest' ? 'Ничего не нужно делать' : paused ? 'Ваше время подождёт' : 'Время для одной задачи';
      const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
      this.elements['timer-progress'].style.width = `${progress * 100}%`;
    }
    updateSettings(settings) {
      const e = this.elements;
      e['music-button'].setAttribute('aria-pressed', String(settings.muted));
      e['music-button'].setAttribute('aria-label', settings.muted ? 'Включить музыку' : 'Выключить музыку');
      e['music-button'].title = settings.muted ? 'Включить музыку' : 'Выключить музыку';
      e['music-button'].querySelector('use').setAttribute('href', settings.muted ? '#i-muted' : '#i-music');
      e['music-toggle'].checked = !settings.muted;
      e['volume-slider'].value = Math.round(settings.volume * 100);
      e['volume-output'].textContent = `${Math.round(settings.volume * 100)}%`;
    }
    updateFullscreen() {
      const fullscreen = Boolean(document.fullscreenElement);
      ['fullscreen-button', 'settings-fullscreen'].forEach(id => {
        this.elements[id].setAttribute('aria-pressed', String(fullscreen));
        this.elements[id].setAttribute('aria-label', fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим');
        this.elements[id].querySelector('use').setAttribute('href', fullscreen ? '#i-exit-fullscreen' : '#i-fullscreen');
      });
    }
    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else this.toast('Этот браузер не поддерживает полноэкранный режим.');
      } catch { this.toast('Полноэкранный режим сейчас недоступен.'); }
      this.updateFullscreen();
    }
    openModal(id) { const dialog = this.elements[id]; if (!dialog.open) dialog.showModal(); }
    closeModal(id) { const dialog = this.elements[id]; if (dialog.open) dialog.close(); }
    toast(message) {
      clearTimeout(this.toastTask);
      this.elements.toast.textContent = message;
      this.elements.toast.hidden = false;
      this.toastTask = setTimeout(() => { this.elements.toast.hidden = true; }, CONFIG.TOAST_DURATION);
    }
    ready() { this.elements.loader.classList.add('is-ready'); setTimeout(() => { this.elements.loader.hidden = true; }, 500); }
  }
  window.Lake.UIManager = UIManager;
})();
