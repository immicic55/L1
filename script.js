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
    mapStage.style.setProperty('--map-rx', `${(-y * 7).toFixed(2)}deg`);
    mapStage.style.setProperty('--map-ry', `${(x * 7).toFixed(2)}deg`);
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
  let sceneInitialized = false;
  let inspectedLayer = null;
  const inspectButtons = bootExperience.querySelectorAll('[data-inspect]');
  inspectButtons.forEach(button => button.addEventListener('click', () => {
    inspectedLayer = button.dataset.inspect === 'auto' ? null : Number(button.dataset.inspect);
    inspectButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.getElementById('inspect-note').textContent = inspectedLayer === null
      ? 'Automatic view restored. Scroll through the boot path on larger screens.'
      : `Inspecting ${names[inspectedLayer]}. Select Automatic view to resume the scroll sequence.`;
    requestBootUpdate();
  }));

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

    if (inspectedLayer !== null) {
      layers.forEach((layer, index) => {
        layer.style.setProperty('--depth', `${index * 36}px`);
        layer.style.setProperty('--offset', `${(index - 2) * 9}px`);
        layer.style.opacity = index <= inspectedLayer ? '1' : '0';
        layer.style.visibility = index <= inspectedLayer ? 'visible' : 'hidden';
      });
      object.style.setProperty('--scene-rotation', '0deg');
      stage.style.setProperty('--boot-progress', `${(inspectedLayer + 1) * 20}%`);
      setActiveLayer(inspectedLayer);
      staticScene = false;
      sceneInitialized = true;
      return;
    }

    if (reducedMotion.matches || compactLayout.matches) {
      if (!staticScene) {
        layers.forEach((layer, index) => {
          layer.style.setProperty('--depth', `${index * 36}px`);
          layer.style.setProperty('--offset', `${(index - 2) * 9}px`);
          layer.style.opacity = '1';
          layer.style.visibility = 'visible';
        });
        object.style.setProperty('--scene-rotation', '0deg');
        stage.style.setProperty('--boot-progress', '100%');
        setActiveLayer(4);
        staticScene = true;
      }
      sceneInitialized = true;
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
      const visible = index <= activeIndex;
      const depth = visible ? index * 36 : -125;
      const offset = (index - 2) * 9 + (visible ? 0 : index % 2 ? 62 : -62);
      layer.style.setProperty('--depth', `${depth.toFixed(1)}px`);
      layer.style.setProperty('--offset', `${offset.toFixed(1)}px`);
      layer.style.opacity = visible ? '1' : '0';
      layer.style.visibility = visible ? 'visible' : 'hidden';
    });
    object.style.setProperty('--scene-rotation', `${(-8 + progress * 16).toFixed(2)}deg`);
    stage.style.setProperty('--boot-progress', `${(20 + progress * 80).toFixed(1)}%`);
    setActiveLayer(activeIndex);
    sceneInitialized = true;
  }

  function requestBootUpdate() {
    if (frameRequested) return;
    if (sceneInitialized) bootExperience.classList.add('is-ready');
    frameRequested = true;
    window.requestAnimationFrame(updateBootScene);
  }

  window.addEventListener('scroll', requestBootUpdate, { passive: true });
  window.addEventListener('resize', requestBootUpdate);
  reducedMotion.addEventListener('change', requestBootUpdate);
  compactLayout.addEventListener('change', requestBootUpdate);
  requestBootUpdate();
}

// Give the document's functional panels a small amount of inspectable depth.
const depthPanels = document.querySelectorAll('.requirement, .profile, .hdk-steps > div, .terminal, .lpm-flow li, .status-facts > div');
const canTiltPanels = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px) and (prefers-reduced-motion: no-preference)');

depthPanels.forEach(panel => {
  panel.classList.add('depth-panel');
  let frame = 0;
  let x = 0;
  let y = 0;

  panel.addEventListener('pointermove', event => {
    if (!canTiltPanels.matches) return;
    const rect = panel.getBoundingClientRect();
    x = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
    y = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5));
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      panel.style.setProperty('--depth-rx', `${(-y * 7).toFixed(2)}deg`);
      panel.style.setProperty('--depth-ry', `${(x * 7).toFixed(2)}deg`);
    });
  }, { passive: true });

  panel.addEventListener('pointerleave', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    panel.style.removeProperty('--depth-rx');
    panel.style.removeProperty('--depth-ry');
  });
});

canTiltPanels.addEventListener('change', () => {
  depthPanels.forEach(panel => {
    panel.style.removeProperty('--depth-rx');
    panel.style.removeProperty('--depth-ry');
  });
});

function evaluateHardware({ architecture, memory, storage, edition }) {
  const minimumStorage = { current: 512, standard: 300, netinstall: 8000 }[edition];
  const issues = [];
  if (!['x86_64', 'i686'].includes(architecture)) issues.push('This architecture is outside the listed x86 targets.');
  if (Number(memory) < 256) issues.push('Memory is below the 256 MiB development boot figure.');
  if (Number(storage) < minimumStorage) issues.push(edition === 'current'
    ? 'The current installer needs at least 512 MiB of disk space.'
    : `This planned edition targets ${edition === 'standard' ? '300 MB' : '8 GB'} of disk space.`);
  return {
    heading: issues.length ? 'Below the listed requirements.' : edition === 'current' ? 'Meets the listed capacity figures.' : 'Meets the planned capacity target.',
    messages: [...issues, edition === 'current'
      ? 'Capacity alone does not confirm hardware compatibility. Check BIOS or UEFI boot support and device drivers.'
      : 'This edition is planned. These targets do not describe an available release.',
      'Source builds need additional memory and working space, depending on the package.'],
    matches: issues.length === 0
  };
}

const hardwareForm = document.getElementById('hardware-checker');
function showHardwareResult() {
  const result = evaluateHardware(Object.fromEntries(new FormData(hardwareForm)));
  const output = document.getElementById('hardware-result');
  output.replaceChildren();
  output.dataset.matches = String(result.matches);
  const heading = document.createElement('strong');
  heading.textContent = result.heading;
  output.append(heading);
  result.messages.forEach(message => {
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    output.append(paragraph);
  });
}
hardwareForm.addEventListener('submit', event => { event.preventDefault(); showHardwareResult(); });
hardwareForm.addEventListener('change', showHardwareResult);

const lpmWalkthrough = [
  ['Start with a readable recipe.', 'A .l1pm recipe describes the package source, dependencies, and build steps. Planning exposes those dependencies before the build starts.', 'recipe → source location\n       → dependencies\n       → build steps'],
  ['Know which source you are building.', 'The verification stage checks the source against the recipe’s hash or pinned commit. A mismatch should be resolved before moving on to compilation.', 'expected source identity\n          ↓\ncompare with fetched source\n          ↓\ncontinue only after verification'],
  ['Turn source into a package.', 'The build stage runs the recipe steps in a prepared work area. Dependencies and a suitable toolchain must be available. Build time, RAM use, and temporary storage vary by package.', 'verified source + dependencies\n          ↓\nconfigure → compile → stage files'],
  ['Keep track of installed files.', 'The final stage installs the package and records its files. That record connects the installed result with the package that produced it.', 'staged package files\n          ↓\ninstallation + package record']
];
const lpmButtons = document.querySelectorAll('[data-lpm-step]');
lpmButtons.forEach(button => button.addEventListener('click', () => {
  const index = Number(button.dataset.lpmStep);
  const [title, description, diagram] = lpmWalkthrough[index];
  const panel = document.getElementById('lpm-explanation');
  lpmButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  panel.querySelector('.tool-label').textContent = `ILLUSTRATIVE WALKTHROUGH / 0${index + 1}`;
  panel.querySelector('h4').textContent = title;
  panel.querySelector('p').textContent = description;
  panel.querySelector('pre').textContent = diagram;
}));

document.getElementById('copy-plan').addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText('lpm plan LLVM.l1pm --repo recipes');
    status.textContent = 'Command copied.';
  } catch {
    status.textContent = 'Select the command text to copy it manually.';
  }
});
