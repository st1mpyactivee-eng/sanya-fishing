(() => {
  'use strict';
  const root = 'assets/characters/main-character/';
  const state = (group, name, motion, anchor = 'bottom-center') => Object.freeze({
    src: `${root}${group}/character-${name}.png`,
    fallbackSrc: `${root}${group}/character-${name}.webp`,
    anchor, motion, group
  });
  const CHARACTER_STATES = Object.freeze({
    'menu-idle': state('menu', 'menu-idle', 'breathing'),
    'menu-choice': state('menu', 'menu-choice', 'breathing'),
    'fishing-ready': state('fishing', 'fishing-ready', 'breathing'),
    'fishing-cast': state('fishing', 'fishing-cast', 'cast'),
    'fishing-wait': state('fishing', 'fishing-wait', 'fishing-wait'),
    'fishing-bite': state('fishing', 'fishing-bite', 'bite'),
    'fishing-pull': state('fishing', 'fishing-pull', 'pull'),
    'fishing-catch': state('fishing', 'fishing-catch', 'catch'),
    'fishing-missed': state('fishing', 'fishing-missed', 'breathing'),
    'work-chop-01': state('work', 'work-chop-01', 'breathing'),
    'work-chop-02': state('work', 'work-chop-02', 'chop'),
    'work-carry': state('work', 'work-carry', 'carry'),
    'work-stack': state('work', 'work-stack', 'breathing'),
    'work-break': state('work', 'work-break', 'breathing'),
    'rest-lie': state('rest', 'rest-lie', 'resting', 'center'),
    'rest-hands-behind-head': state('rest', 'rest-hands-behind-head', 'resting', 'center'),
    'rest-looking-sky': state('rest', 'rest-looking-sky', 'resting', 'center'),
    'rest-eyes-closed': state('rest', 'rest-eyes-closed', 'resting-slow', 'center'),
    'rest-elbows': state('rest', 'rest-elbows', 'resting', 'center')
  });
  const CHARACTER_GROUPS = Object.freeze(Object.fromEntries(['menu', 'fishing', 'work', 'rest'].map(group => [
    group, Object.freeze(Object.keys(CHARACTER_STATES).filter(name => CHARACTER_STATES[name].group === group))
  ])));
  window.Lake.CHARACTER_STATES = CHARACTER_STATES;
  window.Lake.CHARACTER_GROUPS = CHARACTER_GROUPS;
})();
