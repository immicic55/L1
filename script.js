const mapNodes = document.querySelectorAll('[data-map-node]');
const mapLines = document.querySelectorAll('[data-connection]');
const mapRails = document.querySelectorAll('[data-map-rail]');
const mapBranches = document.querySelectorAll('[data-map-branch]');
const mapStage = document.querySelector('.map-stage');
const mapSvg = document.querySelector('.map-connections');
const mapCore = document.querySelector('.map-core');
const readoutLabel = document.getElementById('map-readout-label');
const readoutText = document.getElementById('map-readout-text');

const mapNotes = {
  s6: ['SYSTEM / 01', 's6 starts and supervises services.'],
  lpm: ['SYSTEM / 02', 'LPM plans dependencies and builds from source recipes.'],
  gnu: ['SYSTEM / 03', 'GNU runtime components stay out of the target image.'],
  arch: ['MACHINE / 04', 'Separate i686 and x86_64 builds cover 32 and 64 bits.'],
  boot: ['MACHINE / 05', 'Boot paths cover legacy BIOS and UEFI firmware.'],
  small: ['MACHINE / 06', 'About 70 MB ISO; 256 MiB is the lowest tested boot RAM.']
};

function highlightBranch(id) {
  const group = id ? document.querySelector(`[data-map-node="${id}"]`)?.closest('[data-map-branch]')?.dataset.mapBranch : null;
  mapLines.forEach(line => line.classList.toggle('is-active', line.dataset.connection === id));
  mapRails.forEach(rail => rail.classList.toggle('is-active', !!id && rail.dataset.mapRail === group));
  mapBranches.forEach(branch => branch.classList.toggle('is-active', !!id && branch.dataset.mapBranch === group));
  const note = mapNotes[id] || ['EXPLORE / L1', 'Trace a branch to see how each part fits.'];
  readoutLabel.textContent = note[0];
  readoutText.textContent = note[1];
}

mapNodes.forEach(node => {
  node.addEventListener('pointerenter', () => highlightBranch(node.dataset.mapNode));
  node.addEventListener('pointerleave', () => highlightBranch(null));
  node.addEventListener('focus', () => highlightBranch(node.dataset.mapNode));
  node.addEventListener('blur', () => highlightBranch(null));
});

function drawMapConnections() {
  if (!mapStage || !mapSvg || !mapCore) return;
  const stage = mapStage.getBoundingClientRect();
  const core = mapCore.getBoundingClientRect();
  const mid = rect => rect.top - stage.top + rect.height / 2;
  const px = value => Math.round(value * 10) / 10;
  mapSvg.setAttribute('viewBox', `0 0 ${px(stage.width)} ${px(stage.height)}`);

  mapBranches.forEach(branch => {
    const isLeft = branch.dataset.mapBranch === 'system';
    const nodes = [...branch.querySelectorAll('[data-map-node]')];
    const edge = isLeft ? core.left - stage.left : core.right - stage.left;
    const nearestNodeEdge = isLeft
      ? nodes[0].getBoundingClientRect().right - stage.left
      : nodes[0].getBoundingClientRect().left - stage.left;
    const railX = (edge + nearestNodeEdge) / 2;
    const rootY = mid(core);
    const firstY = mid(nodes[0].getBoundingClientRect());
    const lastY = mid(nodes[nodes.length - 1].getBoundingClientRect());
    const rail = mapSvg.querySelector(`[data-map-rail="${branch.dataset.mapBranch}"]`);
    rail.setAttribute('d', `M ${px(edge)} ${px(rootY)} H ${px(railX)} M ${px(railX)} ${px(firstY)} V ${px(lastY)}`);

    nodes.forEach(node => {
      const rect = node.getBoundingClientRect();
      const nodeEdge = isLeft ? rect.right - stage.left : rect.left - stage.left;
      const line = mapSvg.querySelector(`[data-connection="${node.dataset.mapNode}"]`);
      line.setAttribute('d', `M ${px(railX)} ${px(mid(rect))} H ${px(nodeEdge)}`);
    });
  });
}

if (mapStage && 'ResizeObserver' in window) {
  new ResizeObserver(drawMapConnections).observe(mapStage);
} else {
  window.addEventListener('resize', drawMapConnections);
}
window.addEventListener('load', drawMapConnections);
drawMapConnections();

if (mapStage) {
  const canTiltMap = window.matchMedia('(pointer: fine) and (min-width: 621px) and (prefers-reduced-motion: no-preference)');
  let tiltFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function updateMapTilt() {
    tiltFrame = 0;
    const rect = mapStage.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (pointerX - rect.left - rect.width / 2) / (rect.width / 2)));
    const y = Math.max(-1, Math.min(1, (pointerY - rect.top - rect.height / 2) / (rect.height / 2)));
    mapStage.style.setProperty('--map-rx', `${(-y * 3).toFixed(2)}deg`);
    mapStage.style.setProperty('--map-ry', `${(x * 3).toFixed(2)}deg`);
  }

  function resetMapTilt() {
    if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    mapStage.style.removeProperty('--map-rx');
    mapStage.style.removeProperty('--map-ry');
  }

  mapStage.addEventListener('pointermove', event => {
    if (!canTiltMap.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!tiltFrame) tiltFrame = window.requestAnimationFrame(updateMapTilt);
  }, { passive: true });
  mapStage.addEventListener('pointerleave', resetMapTilt);
  canTiltMap.addEventListener('change', resetMapTilt);
}

const bootExperience = document.querySelector('.boot-experience');

if (bootExperience) {
  bootExperience.classList.add('is-enhanced');
  const stage = bootExperience.querySelector('.boot-stage');
  const object = bootExperience.querySelector('.stack-object');
  const layers = [...bootExperience.querySelectorAll('[data-layer]')];
  const steps = [...bootExperience.querySelectorAll('.boot-story li')];
  const layerName = bootExperience.querySelector('[data-layer-name]');
  const layerNumber = bootExperience.querySelector('[data-layer-number]');
  const names = ['Firmware', 'Bootloader', 'Kernel + musl', 's6 services', 'Shell'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 760px)');
  const clamp = value => Math.max(0, Math.min(1, value));
  let frameRequested = false;
  let staticScene = false;

  function setActiveLayer(index) {
    steps.forEach((step, stepIndex) => {
      step.classList.toggle('is-active', stepIndex === index);
      if (stepIndex === index) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    layers.forEach((layer, layerIndex) => {
      layer.classList.toggle('is-lit', layerIndex === index);
      layer.style.setProperty('--label-opacity', layerIndex === index ? '1' : '0');
    });
    layerName.textContent = names[index];
    layerNumber.textContent = `${String(index + 1).padStart(2, '0')} / 05`;
  }

  function updateBootScene() {
    frameRequested = false;

    if (reducedMotion.matches || compactLayout.matches) {
      if (!staticScene) {
        layers.forEach((layer, index) => {
          layer.style.setProperty('--depth', `${index * 36}px`);
          layer.style.setProperty('--offset', `${(index - 2) * 9}px`);
          layer.style.opacity = '1';
        });
        object.style.setProperty('--scene-rotation', '0deg');
        stage.style.setProperty('--boot-progress', '100%');
        setActiveLayer(4);
        staticScene = true;
      }
      return;
    }

    staticScene = false;
    const viewportCenter = window.innerHeight * 0.52;
    const first = steps[0].getBoundingClientRect();
    const last = steps[steps.length - 1].getBoundingClientRect();
    const firstCenter = first.top + first.height / 2;
    const lastCenter = last.top + last.height / 2;
    const progress = clamp((viewportCenter - firstCenter) / (lastCenter - firstCenter));

    let activeIndex = 0;
    let closest = Infinity;
    steps.forEach((step, index) => {
      const rect = step.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
      if (distance < closest) {
        closest = distance;
        activeIndex = index;
      }
    });

    layers.forEach((layer, index) => {
      const reveal = clamp(progress * (layers.length - 1) + 1.05 - index);
      const depth = index * 36 - (1 - reveal) * 125;
      const offset = (index - 2) * 9 + (1 - reveal) * (index % 2 ? 62 : -62);
      layer.style.setProperty('--depth', `${depth.toFixed(1)}px`);
      layer.style.setProperty('--offset', `${offset.toFixed(1)}px`);
      layer.style.opacity = (0.12 + reveal * 0.88).toFixed(2);
    });
    object.style.setProperty('--scene-rotation', `${(-3 + progress * 6).toFixed(2)}deg`);
    stage.style.setProperty('--boot-progress', `${(20 + progress * 80).toFixed(1)}%`);
    setActiveLayer(activeIndex);
  }

  function requestBootUpdate() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateBootScene);
  }

  window.addEventListener('scroll', requestBootUpdate, { passive: true });
  window.addEventListener('resize', requestBootUpdate);
  reducedMotion.addEventListener('change', requestBootUpdate);
  compactLayout.addEventListener('change', requestBootUpdate);
  requestBootUpdate();
}
