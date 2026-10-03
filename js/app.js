(() => {
  'use strict';
  const { CONFIG: C, STATES: S, SettingsManager, StateManager, TimerManager, AudioManager, FishingManager, CharacterManager, UIManager } = window.Lake;
  // One namespace contains the constructors; all running managers remain private.
  let storage = null;
  try { storage = window.localStorage; } catch (error) { console.warn('Локальное сохранение недоступно.', error); }
  const settings = new SettingsManager(storage);
  const state = new StateManager();
  const character = new CharacterManager(document.getElementById('character'));
  const audio = new AudioManager(settings.values);
  let selectedWorkDuration = null;
  let restComplete = false;
  let navigationRequest = 0;
  const ui = new UIManager(handleAction);
  const timer = new TimerManager(settings, {
    onTick: snapshot => ui.updateTimer(snapshot),
    onComplete: completed => {
      ui.closeModal('confirm-modal');
      if (completed.kind === 'work') {
        ui.toast('Рабочий этап завершён. Время отдыха!');
        state.transition(S.REST, { startAt: completed.endTime });
      } else {
        restComplete = true;
        state.closeOverlay();
        character.stopCycle();
        character.setState('rest-elbows');
        ui.render(S.REST, { restComplete: true });
        const title = document.getElementById('rest-title');
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
        ui.toast('Отдых завершён. Выберите, чем заняться дальше.');
      }
    }
  });
  const fishing = new FishingManager({
    onBite: deadline => state.transition(S.FISHING_BITE, { deadline }),
    onCatch: () => state.transition(S.FISHING_CATCH),
    onMiss: () => state.transition(S.FISHING_MISSED)
  });
  const setScene = (mode, pose, track) => {
    character.stopCycle();
    character.moveToScene(ui.scene, mode);
    if (track) audio.playTrack(track);
    else audio.stop();
    return pose ? character.setState(pose) : Promise.resolve();
  };
  const fishingPose = async (pose, after = () => {}) => {
    const epoch = state.epoch;
    await character.setState(pose);
    if (epoch === state.epoch) after();
  };
  const workSeconds = minutes => C.DEBUG_MODE ? C.DEBUG_WORK_DURATION : minutes * 60;
  const entries = {
    MENU: () => {
      timer.stop(); fishing.reset(); setScene('menu', 'menu-idle');
      state.schedule(() => character.setState('menu-choice'), 5000);
    },
    WORK_SETUP: () => {
      timer.stop(); fishing.reset(); selectedWorkDuration = null;
      ui.selectDuration(null); setScene('work', 'menu-choice');
    },
    WORK: payload => {
      setScene('work', null, 'work');
      character.startCycle(C.WORK_CYCLE);
      if (payload.resume) timer.resume();
      else timer.start('work', payload.durationSeconds || workSeconds(selectedWorkDuration || settings.get('lastWorkDuration')), {
        endTime: payload.endTime, selectedWorkDuration: selectedWorkDuration || settings.get('lastWorkDuration')
      });
    },
    WORK_PAUSED: payload => {
      if (!payload.restored) timer.pause();
      setScene('work', 'work-break', 'work');
    },
    REST: payload => {
      fishing.reset(); restComplete = false;
      setScene('rest', null, 'rest'); character.startCycle(C.REST_CYCLE);
      timer.start('rest', C.REST_DURATION, { endTime: payload.endTime ?? (payload.startAt ? payload.startAt + C.REST_DURATION * 1000 : undefined) });
    },
    FISHING_IDLE: () => { timer.stop(); fishing.reset(); setScene('fishing', 'fishing-ready', 'fishing'); },
    FISHING_CAST: () => {
      fishingPose('fishing-cast', () => state.schedule(() => state.transition(S.FISHING_WAIT), C.FISHING_CAST_DURATION));
    },
    FISHING_WAIT: () => { fishingPose('fishing-wait', () => fishing.beginWait()); },
    FISHING_BITE: payload => { character.setState('fishing-bite'); fishing.beginBite(payload.deadline); },
    FISHING_CATCH: () => {
      fishingPose('fishing-pull', () => {
        state.schedule(() => fishingPose('fishing-catch', () => {
          state.schedule(() => state.transition(S.FISHING_IDLE), C.FISHING_CATCH_DURATION);
        }), C.FISHING_PULL_DURATION);
      });
    },
    FISHING_MISSED: () => {
      fishingPose('fishing-missed', () => state.schedule(() => state.transition(S.FISHING_IDLE), C.FISHING_MISSED_DURATION));
    },
    SETTINGS: () => ui.openModal('settings-modal'),
    ABOUT: () => ui.openModal('about-modal')
  };
  Object.entries(entries).forEach(([name, enter]) => state.register(name, {
    enter,
    exit: next => {
      if (name === S.SETTINGS) ui.closeModal('settings-modal');
      if (name === S.ABOUT) ui.closeModal('about-modal');
      if (name.startsWith('FISHING_') && !next.startsWith('FISHING_')) fishing.reset();
    }
  }));
  state.subscribe(() => ui.render(state.activeState, { restComplete, overlay: state.hasOverlay }));
  const applySettings = values => {
    audio.setVolume(values.volume);
    if (values.muted) audio.mute(); else audio.unmute();
    ui.updateSettings(values);
  };
  settings.subscribe(applySettings);
  applySettings(settings.values);

  const actions = {
    work: () => state.transition(S.WORK_SETUP),
    fish: () => state.transition(S.FISHING_IDLE),
    menu: () => { ui.closeModal('confirm-modal'); state.transition(S.MENU); },
    duration: minutes => {
      if (state.activeState !== S.WORK_SETUP || !C.WORK_DURATIONS.includes(minutes)) return;
      selectedWorkDuration = minutes;
      settings.set('lastWorkDuration', minutes);
      ui.selectDuration(minutes);
    },
    'start-work': () => { if (selectedWorkDuration) state.transition(S.WORK); },
    pause: () => { timer.tick(); if (timer.kind === 'work') state.transition(S.WORK_PAUSED); },
    resume: () => state.transition(S.WORK, { resume: true }),
    reset: () => { if ([S.WORK, S.WORK_PAUSED].includes(state.activeState)) ui.openModal('confirm-modal'); },
    'cancel-reset': () => ui.closeModal('confirm-modal'),
    'confirm-reset': () => { ui.closeModal('confirm-modal'); state.transition(S.WORK_SETUP); },
    cast: () => { ui.openCharacterDialog(); state.transition(S.FISHING_CAST); },
    hook: () => { ui.openCharacterDialog(); fishing.hook(); },
    'character-interact': () => {
      const action = { FISHING_IDLE: 'cast', FISHING_BITE: 'hook' }[state.activeState];
      if (action) actions[action]();
      else ui.toggleCharacterDialog();
    },
    'close-character-dialog': () => ui.closeCharacterDialog(true),
    settings: () => state.transition(S.SETTINGS),
    about: () => state.transition(S.ABOUT),
    'close-modal': () => state.closeOverlay(),
    music: () => settings.set('muted', !settings.get('muted')),
    'set-muted': value => settings.set('muted', value),
    volume: value => settings.set('volume', value),
    'reset-settings': () => { settings.reset(); ui.toast('Настройки восстановлены.'); },
    fullscreen: () => ui.toggleFullscreen()
  };
  async function handleAction(action, value) {
    audio.unlock();
    if (['work', 'fish', 'menu', 'confirm-reset'].includes(action)) {
      const request = ++navigationRequest;
      const epoch = state.epoch;
      if (action === 'work' || action === 'fish') {
        ui.scene.setAttribute('aria-busy', 'true');
        await character.preloadGroup(action === 'work' ? 'work' : 'fishing');
        if (request === navigationRequest) ui.scene.removeAttribute('aria-busy');
        if (request !== navigationRequest || epoch !== state.epoch) return;
      } else ui.scene.removeAttribute('aria-busy');
    }
    actions[action]?.(value);
  }

  const restoreSession = async () => {
    const saved = timer.restore();
    if (!saved) { state.transition(S.MENU); return; }
    await character.preloadGroup(saved.timerState === S.WORK_PAUSED ||
      (saved.timerState === S.WORK && saved.timerEndTime > Date.now()) ? 'work' : 'rest');
    selectedWorkDuration = saved.selectedWorkDuration;
    if (saved.timerState === S.WORK_PAUSED) {
      timer.loadPaused(saved);
      state.transition(S.WORK_PAUSED, { restored: true });
    } else if (saved.timerState === S.WORK && saved.timerEndTime > Date.now()) {
      state.transition(S.WORK, { durationSeconds: saved.totalMs / 1000, endTime: saved.timerEndTime });
    } else {
      const endTime = saved.timerState === S.WORK ? saved.timerEndTime + C.REST_DURATION * 1000 : saved.timerEndTime;
      state.transition(S.REST, { endTime });
    }
    ui.toast('Вернулись к вашему берегу. Таймер восстановлен.');
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { timer.tick(); fishing.check(); }
  });
  window.addEventListener('pageshow', () => { timer.tick(); fishing.check(); });
  window.addEventListener('pagehide', () => timer.save());

  const background = new Promise(resolve => {
    const image = document.getElementById('lake-background');
    if (image.complete) { if (!image.naturalWidth) image.hidden = true; resolve(); return; }
    const timeout = setTimeout(resolve, C.PRELOAD_TIMEOUT);
    image.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
    image.addEventListener('error', () => { clearTimeout(timeout); image.hidden = true; resolve(); }, { once: true });
  });
  Promise.all([background, character.preloadGroup('menu')]).then(async () => { await restoreSession(); ui.ready(); });
})();
