// muscle-map.js — SVG body map for muscle visualization and pain selection
// Extracted from evihealth-mapa-dolor-v7.html by Blanca

let frontalSVG = '';
let dorsalSVG = '';
let loadPromise = null;
const activeJoints = new Set();

// Load the SVG — returns a promise that resolves when ready
function loadBodyMap() {
  if (loadPromise) return loadPromise;

  loadPromise = fetch('assets/body-map-v7.html')
    .then(r => r.text())
    .then(html => {
      const frontalMatch = html.match(/<svg[^>]*id="dz-svg-frontal"[^>]*>[\s\S]*?<\/svg>/);
      if (frontalMatch) frontalSVG = frontalMatch[0];

      const dorsalMatch = html.match(/<svg[^>]*id="dz-svg-dorsal"[^>]*>[\s\S]*?<\/svg>/);
      if (dorsalMatch) dorsalSVG = dorsalMatch[0];

      console.log('Body map loaded. Frontal:', frontalSVG.length, 'Dorsal:', dorsalSVG.length);
    })
    .catch(err => {
      console.error('Error loading body map:', err);
      loadPromise = null; // Allow retry
    });

  return loadPromise;
}

// Render muscle map in exercise player (read-only, highlights muscles)
export async function renderExerciseMap(containerId, muscles) {
  await loadBodyMap();

  const container = document.getElementById(containerId);
  if (!container || !frontalSVG) return;

  let svg = frontalSVG
    .replace('id="dz-svg-frontal"', 'id="exercise-muscle-svg"')
    .replace('class="dz-silueta dz-visible"', 'class="muscle-map-svg"');

  container.innerHTML = `
    <div class="muscle-map-container">
      <h4 class="muscle-map-title">Musculos trabajados</h4>
      <div class="muscle-map-wrap">${svg}</div>
      <div class="muscle-map-legend">
        <span class="legend-item"><span class="legend-dot legend-primary"></span> Principal</span>
        <span class="legend-item"><span class="legend-dot legend-secondary"></span> Secundario</span>
      </div>
    </div>
  `;

  // Remove joint zones (not needed in exercise view)
  container.querySelectorAll('.joint-zone').forEach(el => el.remove());

  // Reset all muscles to default
  container.querySelectorAll('.bh-muscle').forEach(el => {
    el.classList.remove('bh-exercise-1', 'bh-exercise-2');
  });

  // Highlight muscles for this exercise
  if (muscles) {
    Object.entries(muscles).forEach(([slug, intensity]) => {
      const cls = intensity === 2 ? 'bh-exercise-2' : 'bh-exercise-1';
      container.querySelectorAll(`[data-slug="${slug}"]`).forEach(el => {
        el.classList.add(cls);
      });
    });
  }
}

// Render pain map in check-in (interactive, clickable joints) — frontal + dorsal
export async function renderPainMap(containerId) {
  await loadBodyMap();

  const container = document.getElementById(containerId);
  if (!container || !frontalSVG) return;

  let svgFront = frontalSVG
    .replace('id="dz-svg-frontal"', 'id="pain-map-frontal"')
    .replace('class="dz-silueta dz-visible"', 'class="pain-map-svg"');

  let svgBack = dorsalSVG
    ? dorsalSVG
        .replace('id="dz-svg-dorsal"', 'id="pain-map-dorsal"')
        .replace('class="dz-silueta"', 'class="pain-map-svg"')
    : '';

  container.innerHTML = `
    <div class="pain-map-container">
      <div class="pain-map-tabs">
        <button class="pain-tab active" data-view="frontal">Frente</button>
        <button class="pain-tab" data-view="dorsal">Espalda</button>
      </div>
      <div class="pain-map-wrap">
        <div id="pain-view-frontal">${svgFront}</div>
        <div id="pain-view-dorsal" style="display:none">${svgBack}</div>
      </div>
      <p class="pain-map-hint">Toque las zonas ovaladas donde siente dolor (se marcan en rojo)</p>
      <div id="pain-zones-summary" class="pain-zones-summary"></div>
    </div>
  `;

  // Setup tab switching
  container.querySelectorAll('.pain-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.pain-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      const front = container.querySelector('#pain-view-frontal');
      const back = container.querySelector('#pain-view-dorsal');
      if (front) front.style.display = view === 'frontal' ? 'block' : 'none';
      if (back) back.style.display = view === 'dorsal' ? 'block' : 'none';
    });
  });

  // Setup joint clicking
  container.querySelectorAll('.joint-zone').forEach(zone => {
    zone.addEventListener('click', () => {
      const joint = zone.dataset.joint;
      if (activeJoints.has(joint)) {
        activeJoints.delete(joint);
        container.querySelectorAll(`.joint-zone[data-joint="${joint}"]`).forEach(z => {
          z.classList.remove('joint-active');
        });
      } else {
        activeJoints.add(joint);
        container.querySelectorAll(`.joint-zone[data-joint="${joint}"]`).forEach(z => {
          z.classList.add('joint-active');
        });
      }
      updatePainSummary(container);
    });
  });

  // Restore previously selected joints
  activeJoints.forEach(joint => {
    container.querySelectorAll(`.joint-zone[data-joint="${joint}"]`).forEach(z => {
      z.classList.add('joint-active');
    });
  });
  updatePainSummary(container);
}

const JOINT_LABELS = {
  'cuello': 'Cuello', 'cervical': 'Cervical',
  'hombro-d': 'Hombro der.', 'hombro-i': 'Hombro izq.',
  'codo-d': 'Codo der.', 'codo-i': 'Codo izq.',
  'mano-d': 'Mano der.', 'mano-i': 'Mano izq.',
  'cadera-d': 'Cadera der.', 'cadera-i': 'Cadera izq.',
  'rodilla-d': 'Rodilla der.', 'rodilla-i': 'Rodilla izq.',
  'tobillo-d': 'Tobillo der.', 'tobillo-i': 'Tobillo izq.',
  'pie-d': 'Pie der.', 'pie-i': 'Pie izq.',
  'dorsal-alta': 'Espalda alta', 'dorsal-media': 'Espalda media',
  'lumbar': 'Lumbar', 'sacro': 'Sacro'
};

function updatePainSummary(container) {
  const summary = container.querySelector('#pain-zones-summary');
  if (!summary) return;
  if (activeJoints.size === 0) {
    summary.textContent = 'Ninguna zona seleccionada';
  } else {
    const labels = Array.from(activeJoints).map(j => JOINT_LABELS[j] || j);
    summary.textContent = 'Dolor en: ' + labels.join(', ');
  }
}

export function getActiveJoints() {
  return Array.from(activeJoints);
}

export function getActiveJointsString() {
  if (activeJoints.size === 0) return 'none';
  return Array.from(activeJoints).join(',');
}

export function clearJoints() {
  activeJoints.clear();
}

export async function initMuscleMap() {
  await loadBodyMap();
}
