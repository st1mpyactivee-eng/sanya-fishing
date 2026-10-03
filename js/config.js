(() => {
  'use strict';
  const Lake = window.Lake = window.Lake || {};
  const DEBUG_MODE = false;
  Lake.CONFIG = Object.freeze({
    DEBUG_MODE,
    VERSION: 1,
    SETTINGS_KEY: 'quiet-shore.settings',
    TIMER_KEY: 'quiet-shore.timer',
    WORK_DURATIONS: Object.freeze([15, 25, 45, 60]),
    REST_DURATION: DEBUG_MODE ? 10 : 5 * 60,
    DEBUG_WORK_DURATION: 20,
    FISHING_BITE_MIN: DEBUG_MODE ? 3000 : 8000,
    FISHING_BITE_MAX: DEBUG_MODE ? 7000 : 28000,
    FISHING_REACTION_TIME: DEBUG_MODE ? 15000 : 3500,
    FISHING_STORY_INTERVAL: 18000,
    FISHING_CAST_DURATION: 1800,
    FISHING_PULL_DURATION: 1400,
    FISHING_CATCH_DURATION: 6500,
    FISHING_MISSED_DURATION: 3500,
    MUSIC_FADE_DURATION: 2000,
    CHARACTER_TRANSITION: 600,
    CHARACTER_SCENE_FADE_OUT: 180,
    CHARACTER_SCENE_FADE_IN: 320,
    TIMER_TICK_INTERVAL: 250,
    TOAST_DURATION: 4500,
    PRELOAD_TIMEOUT: 6000,
    AUDIO_TRACKS: Object.freeze({
      fishing: 'music/Fishing.mp3',
      work: 'music/Work.mp3',
      rest: 'music/Rest.mp3'
    }),
    BACKGROUND_PATH: 'assets/images/background/lake-background.webp',
    WORK_CYCLE: Object.freeze([
      { pose: 'work-chop-01', duration: 3000 },
      { pose: 'work-chop-02', duration: 2200 },
      { pose: 'work-chop-01', duration: 3200 },
      { pose: 'work-chop-02', duration: 2400 },
      { pose: 'work-break', duration: 9000 },
      { pose: 'work-carry', duration: 8000 },
      { pose: 'work-stack', duration: 7000 }
    ]),
    REST_CYCLE: Object.freeze([
      { pose: 'rest-lie', duration: 20000 },
      { pose: 'rest-looking-sky', duration: 24000 },
      { pose: 'rest-hands-behind-head', duration: 25000 },
      { pose: 'rest-eyes-closed', duration: 30000 },
      { pose: 'rest-elbows', duration: 18000 }
    ])
  });
  Lake.STATES = Object.freeze(Object.fromEntries([
    'MENU', 'WORK_SETUP', 'WORK', 'WORK_PAUSED', 'REST',
    'FISHING_IDLE', 'FISHING_CAST', 'FISHING_WAIT', 'FISHING_BITE',
    'FISHING_CATCH', 'FISHING_MISSED', 'SETTINGS', 'ABOUT'
  ].map(state => [state, state])));
  const S = Lake.STATES;
  const destinations = [S.MENU, S.WORK_SETUP, S.FISHING_IDLE];
  Lake.TRANSITIONS = Object.freeze({
    MENU: [S.WORK_SETUP, S.FISHING_IDLE],
    WORK_SETUP: [S.MENU, S.WORK],
    WORK: [S.WORK_PAUSED, S.REST, S.WORK_SETUP, S.MENU],
    WORK_PAUSED: [S.WORK, S.WORK_SETUP, S.MENU],
    REST: destinations,
    FISHING_IDLE: [S.FISHING_CAST, S.MENU],
    FISHING_CAST: [S.FISHING_WAIT, S.MENU],
    FISHING_WAIT: [S.FISHING_BITE, S.MENU],
    FISHING_BITE: [S.FISHING_CATCH, S.FISHING_MISSED, S.MENU],
    FISHING_CATCH: [S.FISHING_IDLE, S.MENU],
    FISHING_MISSED: [S.FISHING_IDLE, S.MENU]
  });
})();
