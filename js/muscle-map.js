// muscle-map.js — SVG body map for muscle visualization and pain selection
// Male: evihealth-mapa-dolor-v7.html (by Blanca)
// Female: react-native-body-highlighter (HichamELBSI)

const maps = {
  male: { frontal: '', dorsal: '', promise: null },
  female: { frontal: '', dorsal: '', promise: null }
};
let currentSex = 'male';
const activeJoints = new Set();

function getMapFile(sex) {
  return sex === 'female' ? 'assets/body-map-female.html' : 'assets/body-map-v7.html';
}

function getRegex(sex) {
  if (sex === 'female') {
    return {
      frontal: /<svg[^>]*id="dz-svg-female-frontal"[^>]*>[\s\S]*?<\/svg>/,
      dorsal: /<svg[^>]*id="dz-svg-female-dorsal"[^>]*>[\s\S]*?<\/svg>/
    };
  }
  return {
    frontal: /<svg[^>]*id="dz-svg-frontal"[^>]*>[\s\S]*?<\/svg>/,
    dorsal: /<svg[^>]*id="dz-svg-dorsal"[^>]*>[\s\S]*?<\/svg>/
  };
}

// Load the SVG for a specific sex
function loadBodyMap(sex) {
  if (!sex) sex = currentSex;
  const map = maps[sex];
  if (map.promise) return map.promise;

  const file = getMapFile(sex);
  const regex = getRegex(sex);

  map.promise = fetch(file)
    .then(r => r.text())
    .then(html => {
      const frontalMatch = html.match(regex.frontal);
      if (frontalMatch) map.frontal = frontalMatch[0];

      const dorsalMatch = html.match(regex.dorsal);
      if (dorsalMatch) map.dorsal = dorsalMatch[0];

      console.log(`Body map (${sex}) loaded. Frontal: ${map.frontal.length}, Dorsal: ${map.dorsal.length}`);
    })
    .catch(err => {
      console.error(`Error loading body map (${sex}):`, err);
      map.promise = null;
    });

  return map.promise;
}

// Detect user sex from profile in localStorage
function detectUserSex() {
  try {
    const profile = JSON.parse(localStorage.getItem('evihealth_user'));
    if (profile && profile.sex) {
      currentSex = profile.sex === 'female' ? 'female' : 'male';
    }
  } catch { /* ignore */ }
  return currentSex;
}

// Render muscle map in exercise player (read-only, highlights muscles)
export async function renderExerciseMap(containerId, muscles) {
  const sex = detectUserSex();
  await loadBodyMap(sex);

  const map = maps[sex];
  const container = document.getElementById(containerId);
  if (!container || !map.frontal) return;

  let svg = map.frontal
    .replace(/id="dz-svg-[^"]*"/, 'id="exercise-muscle-svg"')
    .replace(/class="dz-silueta[^"]*"/, 'class="muscle-map-svg"');

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
  const sex = detectUserSex();
  await loadBodyMap(sex);

  const map = maps[sex];
  const container = document.getElementById(containerId);
  if (!container || !map.frontal) return;

  let svgFront = map.frontal
    .replace(/id="dz-svg-[^"]*"/, 'id="pain-map-frontal"')
    .replace(/class="dz-silueta[^"]*"/, 'class="pain-map-svg"');

  let svgBack = map.dorsal
    ? map.dorsal
        .replace(/id="dz-svg-[^"]*"/, 'id="pain-map-dorsal"')
        .replace(/class="dz-silueta[^"]*"/, 'class="pain-map-svg"')
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
  detectUserSex();
  // Preload the map for detected sex, lazy-load the other
  await loadBodyMap(currentSex);
}
