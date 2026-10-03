(() => {
  const { CharacterManager, CHARACTER_STATES, CONFIG } = Lake;
  const character = new CharacterManager(document.getElementById('character'));
  const status = document.getElementById('status');
  const buttons = document.getElementById('states');
  for (const pose of Object.keys(CHARACTER_STATES)) {
    const button = document.createElement('button');
    button.textContent = pose;
    button.dataset.pose = pose;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      character.stopCycle();
      status.textContent = pose;
      await character.setState(pose);
    });
    buttons.append(button);
  }
  new MutationObserver(() => {
    const pose = character.element.dataset.pose;
    status.textContent = `${pose} · ${CHARACTER_STATES[pose]?.anchor || ''}`;
    [...buttons.children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pose === pose)));
  }).observe(character.element, { attributes: true, attributeFilter: ['data-pose'] });
  document.getElementById('work').onclick = () => character.startCycle(CONFIG.WORK_CYCLE);
  document.getElementById('rest').onclick = () => character.startCycle(CONFIG.REST_CYCLE);
  const stage = document.getElementById('stage');
  const checker = getComputedStyle(stage).background;
  document.getElementById('backdrop').onchange = event => {
    stage.style.background = event.target.value === 'checker' ? checker : event.target.value === 'lake' ?
      'url(assets/images/background/lake-background.webp) center/cover' : event.target.value;
  };
  character.preloadGroup('menu').then(() => character.setState('menu-idle'));
})();
