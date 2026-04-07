// checkin.js — Mood and pain check-in logic

let currentMood = null;
let currentPain = 0;
let currentPainLocation = 'both-knees';

export function initCheckin() {
  setupMoodButtons();
  setupPainSlider();
  setupPainLocation();
  setupPostMoodButtons();
}

function setupMoodButtons() {
  const container = document.getElementById('mood-buttons');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;

    // Deselect all
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

    // Update color based on pain level
    display.className = 'pain-number';
    if (currentPain <= 3) display.classList.add('pain-low');
    else if (currentPain <= 6) display.classList.add('pain-mid');
    else display.classList.add('pain-high');
  });
}

function setupPainLocation() {
  const container = document.getElementById('pain-location');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.location-btn');
    if (!btn) return;

    container.querySelectorAll('.location-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentPainLocation = btn.dataset.location;
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
    // Save post-exercise mood
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
  return currentPainLocation;
}

export function resetCheckin() {
  currentMood = null;
  currentPain = 0;
  currentPainLocation = 'both-knees';

  const slider = document.getElementById('pain-slider');
  const display = document.getElementById('pain-value');
  if (slider) slider.value = 0;
  if (display) {
    display.textContent = '0';
    display.className = 'pain-number pain-low';
  }

  document.querySelectorAll('#mood-buttons .mood-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('#pain-location .location-btn').forEach(b => b.classList.remove('selected'));
  // Default selection
  const defaultLoc = document.querySelector('[data-location="both-knees"]');
  if (defaultLoc) defaultLoc.classList.add('selected');
}
