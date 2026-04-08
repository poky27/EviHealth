// routines.js — Routine generation algorithm (mood-pain matrix)

import { filterExercises, selectExercises } from './exercises.js';

// Routine type definitions
const ROUTINE_TYPES = {
  completa: {
    name: 'Completa',
    emoji: '\u{1F7E2}',
    cssClass: 'routine-type-completa',
    duration: 30,
    message: 'Excelente dia para dar lo mejor!',
    blocks: [
      { category: 'warmup-cooldown', count: 2, label: 'Calentamiento', tags: ['warmup'] },
      { category: 'knee-strengthening', count: 2, label: 'Fortalecimiento de rodilla' },
      { category: 'core-safe', count: 2, label: 'Core seguro (perimetro abdominal)' },
      { category: 'kyphosis-correction', count: 2, label: 'Correccion de postura' },
      { category: 'warmup-cooldown', count: 2, label: 'Enfriamiento', tags: ['cooldown', 'stretching'] }
    ]
  },
  suave: {
    name: 'Suave',
    emoji: '\u{1F7E1}',
    cssClass: 'routine-type-suave',
    duration: 20,
    message: 'Hoy cuidamos tus articulaciones con ejercicios suaves.',
    blocks: [
      { category: 'chair-exercises', count: 3, label: 'Ejercicios en silla' },
      { category: 'warmup-cooldown', count: 2, label: 'Estiramientos suaves', tags: ['stretching'] },
      { category: 'core-safe', count: 1, label: 'Core suave', chairOnly: true },
      { category: 'kyphosis-correction', count: 1, label: 'Postura suave', chairOnly: true },
      { category: 'breathing-relaxation', count: 1, label: 'Respiracion' }
    ]
  },
  motivadora: {
    name: 'Motivadora',
    emoji: '\u{1F535}',
    cssClass: 'routine-type-motivadora',
    duration: 15,
    message: 'Un paso a la vez. Cada movimiento cuenta.',
    blocks: [
      { category: 'warmup-cooldown', count: 1, label: 'Calentamiento ligero', tags: ['warmup'] },
      { category: 'knee-strengthening', count: 1, label: 'Rodilla facil', maxDifficulty: 1 },
      { category: 'core-safe', count: 1, label: 'Core facil', maxDifficulty: 1 },
      { category: 'balance-mobility', count: 1, label: 'Equilibrio y movilidad' },
      { category: 'breathing-relaxation', count: 1, label: 'Respiracion' }
    ]
  },
  minima: {
    name: 'Minima',
    emoji: '\u{1F7E0}',
    cssClass: 'routine-type-minima',
    duration: 10,
    message: 'Solo lo esencial. Estar aqui ya es un logro.',
    blocks: [
      { category: 'chair-exercises', count: 2, label: 'Silla facil', maxDifficulty: 1 },
      { category: 'breathing-relaxation', count: 2, label: 'Respiracion y relajacion' },
      { category: 'warmup-cooldown', count: 1, label: 'Estiramiento sentado', chairOnly: true }
    ]
  }
};

export function determineRoutineType(mood, pain) {
  const highMood = mood >= 4;
  const highPain = pain >= 5;

  if (highMood && !highPain) return 'completa';
  if (highMood && highPain) return 'suave';
  if (!highMood && !highPain) return 'motivadora';
  return 'minima'; // low mood + high pain
}

export function generateRoutine(mood, pain, painLocation, yesterdayIds = []) {
  const type = determineRoutineType(mood, pain);
  const routineDef = ROUTINE_TYPES[type];
  const exercises = [];

  for (const block of routineDef.blocks) {
    const candidates = filterExercises({
      category: block.category,
      maxPain: pain,
      minMood: mood,
      chairOnly: block.chairOnly || false,
      painLocation: painLocation
    }).filter(ex => {
      // Additional block-level filters
      if (block.maxDifficulty !== undefined && ex.difficulty > block.maxDifficulty) return false;
      if (block.tags) {
        return block.tags.some(tag => ex.tags.includes(tag));
      }
      return true;
    });

    const selected = selectExercises(candidates, block.count, yesterdayIds);
    exercises.push(...selected.map(ex => ({
      ...ex,
      blockLabel: block.label
    })));
  }

  return {
    type,
    ...routineDef,
    exercises,
    generatedAt: new Date().toISOString()
  };
}

export function getRoutineTypes() {
  return ROUTINE_TYPES;
}
