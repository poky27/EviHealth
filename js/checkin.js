// checkin.js — Mood and pain check-in logic
// Pain location now comes from muscle-map.js (interactive SVG)

import { getActiveJointsString, clearJoints } from './muscle-map.js';

let currentMood = null;
let currentPain = 0;

export function initCheckin() {
  setupMoodButtons();
  setupPainSlider();
  setupPostMoodButtons();
}

function setupMoodButtons() {
  const container = document.getElementById('mood-buttons');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;

    container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    currentMood = parseInt(btn.dataset.mood);

    // Auto-advance after short delay
    setTimeout(() => {
      window.FenixFit.showScreen('screen-checkin-pain');
    }, 300);
  });
}

function setupPainSlider() {
  const slider = document.getElementById('pain-slider');
  const display = document.getElementById('pain-value');
  if (!slider || !display) return;

  slider.addEventListener('input', () => {
    currentPain = parseInt(slider.value);
    display.textContent = currentPain;

    display.className = 'pain-number';
    if (currentPain <= 3) display.classList.add('pain-low');
    else if (currentPain <= 6) display.classList.add('pain-mid');
    else display.classList.add('pain-high');
  });
}

function setupPostMoodButtons() {
  const container = document.getElementById('post-mood-buttons');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;

    container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const postMood = parseInt(btn.dataset.postmood);
    window.FenixFit.savePostMood(postMood);
  });
}

export function getMood() {
  return currentMood;
}

export function getPain() {
  return currentPain;
}

export function getPainLocation() {
  // Now returns joints from the interactive SVG map
  return getActiveJointsString();
}

export function resetCheckin() {
  currentMood = null;
  currentPain = 0;
  clearJoints();

  const slider = document.getElementById('pain-slider');
  const display = document.getElementById('pain-value');
  if (slider) slider.value = 0;
  if (display) {
    display.textContent = '0';
    display.className = 'pain-number pain-low';
  }

  document.querySelectorAll('#mood-buttons .mood-btn').forEach(b => b.classList.remove('selected'));
}
