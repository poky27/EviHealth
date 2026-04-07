// exercises.js — Carga y filtrado de ejercicios

let exerciseDatabase = [];

export async function loadExercises() {
  try {
    const response = await fetch('data/exercises.json');
    exerciseDatabase = await response.json();
    return exerciseDatabase;
  } catch (error) {
    console.error('Error cargando ejercicios:', error);
    return [];
  }
}

export function getAllExercises() {
  return exerciseDatabase;
}

export function getExerciseById(id) {
  return exerciseDatabase.find(ex => ex.id === id);
}

export function getExercisesByCategory(category) {
  return exerciseDatabase.filter(ex => ex.category === category);
}

export function filterExercises({ category, maxPain, minMood, chairOnly, painLocation }) {
  return exerciseDatabase.filter(ex => {
    if (category && ex.category !== category) return false;
    if (maxPain !== undefined && ex.painThreshold < maxPain) return false;
    if (minMood !== undefined && ex.moodMinimum > minMood) return false;
    if (chairOnly && !ex.chairBased) return false;

    // Contraindication guard for pain location
    if (painLocation === 'upper-back' && maxPain >= 6) {
      // Exclude exercises with loaded spinal flexion for high back pain
      if (ex.position === 'prone' && ex.difficulty >= 3) return false;
    }

    return true;
  });
}

// Select N exercises from candidates, avoiding yesterday's exercises
export function selectExercises(candidates, count, yesterdayIds = []) {
  // Prioritize exercises NOT done yesterday
  const fresh = candidates.filter(ex => !yesterdayIds.includes(ex.id));
  const repeated = candidates.filter(ex => yesterdayIds.includes(ex.id));

  // Sort by evidence strength: GUIA-OFICIAL > TEXTO-REF > CONSENSO > others
  const evidenceOrder = { 'GUIA-OFICIAL': 0, 'TEXTO-REF': 1, 'CONSENSO': 2, 'VERIFICAR-FUENTE': 3, 'SIN-VERIFICAR': 4 };
  const sortByEvidence = (a, b) => (evidenceOrder[a.evidence.tag] || 4) - (evidenceOrder[b.evidence.tag] || 4);

  fresh.sort(sortByEvidence);
  repeated.sort(sortByEvidence);

  const pool = [...fresh, ...repeated];

  // Shuffle within same evidence tier for variety
  const selected = [];
  const used = new Set();

  for (const ex of pool) {
    if (selected.length >= count) break;
    if (!used.has(ex.id)) {
      selected.push(ex);
      used.add(ex.id);
    }
  }

  return selected;
}

export function formatDuration(seconds) {
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec > 0 ? `${min} min ${sec} seg` : `${min} min`;
  }
  return `${seconds} seg`;
}
