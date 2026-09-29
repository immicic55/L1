const mapNodes = document.querySelectorAll('[data-map-node]');
const mapLines = document.querySelectorAll('[data-connection]');
const readoutLabel = document.getElementById('map-readout-label');
const readoutText = document.getElementById('map-readout-text');

const mapNotes = {
  s6: ['MAP NOTE / 01', 's6 starts and supervises services.'],
  lpm: ['MAP NOTE / 02', 'LPM plans dependencies and builds from source recipes.'],
  gnu: ['MAP NOTE / 03', 'GNU runtime components stay out of the target image.'],
  arch: ['MAP NOTE / 04', 'Separate i686 and x86_64 builds cover 32 and 64 bits.'],
  boot: ['MAP NOTE / 05', 'Boot paths cover legacy BIOS and UEFI firmware.'],
  small: ['MAP NOTE / 06', 'About 70 MB ISO; 256 MiB is the lowest tested boot RAM.']
};

function highlightBranch(id) {
  mapLines.forEach(line => line.classList.toggle('is-active', line.dataset.connection === id));
  const note = mapNotes[id] || ['MAP NOTE / 00', 'Choose a branch to read its role in L1.'];
  readoutLabel.textContent = note[0];
  readoutText.textContent = note[1];
}

mapNodes.forEach(node => {
  node.addEventListener('pointerenter', () => highlightBranch(node.dataset.mapNode));
  node.addEventListener('pointerleave', () => highlightBranch(null));
  node.addEventListener('focus', () => highlightBranch(node.dataset.mapNode));
  node.addEventListener('blur', () => highlightBranch(null));
});
