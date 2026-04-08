// app.js — EviHealth: Main entry point, screen navigation, orchestration

import { loadExercises, formatDuration } from './exercises.js';
import { initCheckin, getMood, getPain, getPainLocation, resetCheckin } from './checkin.js';
import { generateRoutine } from './routines.js';
import { saveSession, getStreak, getYesterdayExerciseIds, renderProgressScreen } from './progress.js';
import { createEvidenceBadge, createEvidenceBadgeHTML } from './evidence.js';
import { registerParticipant, saveExerciseSession, saveWeeklyTracking, testConnection } from './supabase.js';

let currentRoutine = null;
let currentExerciseIndex = 0;
let completedIds = [];
let skippedIds = [];
let routineStartTime = null;

// ====== USER PROFILE ======
const STORAGE_KEY_USER = 'evihealth_user';
const STORAGE_KEY_TRACKING = 'evihealth_tracking';

function getUserProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_USER));
  } catch { return null; }
}

function saveUserProfile(profile) {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
}

function isRegistered() {
  return getUserProfile() !== null;
}

// ====== SCREEN NAVIGATION ======
function showScreen(screenId) {
  // If not registered and trying to access non-welcome/non-register screens
  if (!isRegistered() && screenId !== 'screen-welcome' && screenId !== 'screen-register') {
    showScreen('screen-register');
    return;
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }

  // Update bottom nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (screenId === 'screen-welcome') {
    document.querySelectorAll('.nav-btn')[0]?.classList.add('active');
  } else if (screenId.startsWith('screen-checkin') || screenId === 'screen-routine' || screenId === 'screen-exercise') {
    document.querySelectorAll('.nav-btn')[1]?.classList.add('active');
  } else if (screenId === 'screen-progress') {
    document.querySelectorAll('.nav-btn')[2]?.classList.add('active');
    renderProgressScreen();
  } else if (screenId === 'screen-tracking') {
    document.querySelectorAll('.nav-btn')[3]?.classList.add('active');
    renderTrackingScreen();
  }
}

function closeModal() {
  const modal = document.getElementById('evidence-modal');
  if (modal) modal.classList.add('hidden');
}

// ====== NIGHT MODE ======
function toggleNightMode() {
  document.body.classList.toggle('night-mode');
  const btn = document.getElementById('mode-toggle');
  if (document.body.classList.contains('night-mode')) {
    btn.innerHTML = '\u{2600}\u{FE0F}'; // sun
    localStorage.setItem('evihealth_nightmode', 'true');
  } else {
    btn.innerHTML = '\u{1F319}'; // moon
    localStorage.setItem('evihealth_nightmode', 'false');
  }
}

function restoreNightMode() {
  if (localStorage.getItem('evihealth_nightmode') === 'true') {
    document.body.classList.add('night-mode');
    const btn = document.getElementById('mode-toggle');
    if (btn) btn.innerHTML = '\u{2600}\u{FE0F}';
  }
}

// ====== REGISTRATION ======
function initRegistration() {
  // Sex buttons
  document.querySelectorAll('.sex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sex-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      checkRegFormComplete();
    });
  });

  // Consent checkbox
  const consent = document.getElementById('reg-consent');
  if (consent) {
    consent.addEventListener('change', checkRegFormComplete);
  }

  // Form inputs
  ['reg-age', 'reg-condition', 'reg-activity'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', checkRegFormComplete);
  });

  // Register button
  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', onRegister);
  }
}

function checkRegFormComplete() {
  const age = document.getElementById('reg-age')?.value;
  const sex = document.querySelector('.sex-btn.selected')?.dataset.sex;
  const condition = document.getElementById('reg-condition')?.value;
  const activity = document.getElementById('reg-activity')?.value;
  const consent = document.getElementById('reg-consent')?.checked;

  const btn = document.getElementById('btn-register');
  if (btn) {
    btn.disabled = !(age && sex && condition && activity && consent);
  }
}

function onRegister() {
  const profile = {
    name: document.getElementById('reg-name')?.value || 'Participante',
    age: parseInt(document.getElementById('reg-age')?.value),
    sex: document.querySelector('.sex-btn.selected')?.dataset.sex,
    condition: document.getElementById('reg-condition')?.value,
    activityLevel: document.getElementById('reg-activity')?.value,
    registeredAt: new Date().toISOString(),
    participantId: 'P-' + Date.now().toString(36).toUpperCase()
  };

  saveUserProfile(profile);

  // Send to Supabase (async, non-blocking)
  registerParticipant(profile).then(result => {
    if (result.ok) {
      console.log('Participante registrado en Supabase');
    } else {
      console.warn('Error registrando en Supabase (datos guardados localmente):', result.error);
    }
  });

  showScreen('screen-checkin-mood');
}

// ====== AGE-BASED RECOMMENDATIONS ======
// [GUIA-OFICIAL: WHO 2020 — same for all 65+, individualize by functional capacity]
// [GUIA-OFICIAL: ACSM Position Stand 2009 — RPE-based, not age-based]
// [TEXTO-REF: ICFSR 2021/2024 — stratify by frailty, not chronological age]
function getAgeRecommendation(age, activityLevel) {
  const rec = {
    aerobic: '150-300 min/semana moderado O 75-150 min/semana vigoroso',
    resistance: '2+ dias/semana, grupos musculares principales',
    balance: '3+ dias/semana (prevencion de caidas)',
    source: 'WHO 2020 Physical Activity Guidelines'
  };

  if (age >= 80 || activityLevel === 'sedentary') {
    rec.note = 'Comenzar con ejercicios en silla. Progresar gradualmente.';
    rec.level = 'Inicio suave';
  } else if (age >= 70) {
    rec.note = 'Incluir equilibrio y prevencion de caidas como prioridad.';
    rec.level = 'Moderado con enfasis en equilibrio';
  } else {
    rec.note = 'Puede realizar el rango completo de ejercicios con progresion.';
    rec.level = 'Completo';
  }

  return rec;
}

// ====== TRACKING / OUTCOMES ======
function getTrackingData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_TRACKING)) || [];
  } catch { return []; }
}

function saveTrackingRecord(record) {
  const data = getTrackingData();
  data.push(record);
  localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(data));
}

function initTracking() {
  // Pain slider
  const slider = document.getElementById('tracking-pain-slider');
  const display = document.getElementById('tracking-pain-value');
  if (slider && display) {
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
      display.className = 'pain-number';
      const v = parseInt(slider.value);
      if (v <= 3) display.classList.add('pain-low');
      else if (v <= 6) display.classList.add('pain-mid');
      else display.classList.add('pain-high');
    });
  }

  // Functional capacity buttons
  document.querySelectorAll('.func-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.func-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Save tracking
  const btnSave = document.getElementById('btn-save-tracking');
  if (btnSave) {
    btnSave.addEventListener('click', onSaveTracking);
  }

  // Export
  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) {
    btnExport.addEventListener('click', onExportData);
  }
}

function onSaveTracking() {
  const pain = parseInt(document.getElementById('tracking-pain-slider')?.value || 0);
  const chairStand = parseInt(document.getElementById('tracking-chairstand')?.value || 0);
  const owd = parseFloat(document.getElementById('tracking-owd')?.value || 0);
  const waist = parseFloat(document.getElementById('tracking-waist')?.value || 0);
  const height = parseFloat(document.getElementById('tracking-height')?.value || 0);
  const neck = parseFloat(document.getElementById('tracking-neck')?.value || 0);
  const funcBtn = document.querySelector('.func-btn.selected');
  const functional = funcBtn ? parseInt(funcBtn.dataset.func) : null;

  // Calculate WHtR if both values provided
  const whtr = (waist > 0 && height > 0) ? parseFloat((waist / height).toFixed(3)) : null;

  // Save height to profile (only needed once)
  if (height > 0) {
    const profile = getUserProfile();
    if (profile && !profile.height) {
      profile.height = height;
      saveUserProfile(profile);
    }
  }

  const record = {
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    pain,
    chairStandCount: chairStand,
    owdCm: owd,
    waistCm: waist,
    heightCm: height,
    neckCm: neck,
    whtr,
    functionalCapacity: functional,
    weekNumber: getWeekNumber()
  };

  saveTrackingRecord(record);

  // Send to Supabase
  const profile = getUserProfile();
  if (profile) {
    saveWeeklyTracking(profile.participantId, record).then(result => {
      if (result.ok) console.log('Tracking enviado a Supabase');
      else console.warn('Error enviando tracking a Supabase:', result.error);
    });
  }

  // Show confirmation
  const btn = document.getElementById('btn-save-tracking');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Guardado!';
    btn.style.background = '#2d7a4f';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
    }, 2000);
  }

  renderTrackingScreen();
}

function getWeekNumber() {
  const profile = getUserProfile();
  if (!profile) return 1;
  const start = new Date(profile.registeredAt);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

function renderTrackingScreen() {
  const profile = getUserProfile();
  const data = getTrackingData();

  // User badge
  const badge = document.getElementById('user-profile-badge');
  if (badge && profile) {
    const sexIcon = profile.sex === 'male' ? '\u{2642}\u{FE0F}' : '\u{2640}\u{FE0F}';
    badge.textContent = `${sexIcon} ${profile.name} | ${profile.age} anos | ID: ${profile.participantId}`;
  }

  // Evolution chart
  renderEvolutionChart(data);

  // Outcomes summary
  renderOutcomesSummary(data);
}

function renderEvolutionChart(data) {
  const container = document.getElementById('tracking-evolution');
  if (!container) return;

  if (data.length < 2) {
    container.innerHTML = '<p style="text-align:center;color:var(--color-text-light);padding:40px 0;">Necesitas al menos 2 mediciones para ver la evolucion.</p>';
    return;
  }

  const width = 360;
  const height = 160;
  const padding = 35;
  const recent = data.slice(-8); // Last 8 measurements

  const xStep = (width - padding * 2) / Math.max(recent.length - 1, 1);

  function makePath(values, maxVal) {
    return values.map((v, i) => {
      const x = padding + i * xStep;
      const y = height - padding - ((v / maxVal) * (height - padding * 2));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }

  const painPath = makePath(recent.map(d => d.pain), 10);
  const funcPath = makePath(recent.map(d => d.functionalCapacity || 3), 5);

  const labels = recent.map((d, i) => {
    const x = padding + i * xStep;
    return `<text x="${x}" y="${height - 5}" text-anchor="middle" font-size="10" fill="#555">S${d.weekNumber || i+1}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;">
      <path d="${painPath}" fill="none" stroke="#c0392b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${funcPath}" fill="none" stroke="#1a6b4a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 4"/>
      ${labels}
      <text x="${width - padding}" y="16" text-anchor="end" font-size="11" fill="#c0392b">Dolor</text>
      <text x="${width - padding}" y="30" text-anchor="end" font-size="11" fill="#1a6b4a">Funcion</text>
    </svg>
  `;
}

function renderOutcomesSummary(data) {
  const container = document.getElementById('tracking-outcomes');
  if (!container) return;

  if (data.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-light);">Sin mediciones aun. Completa tu primera evaluacion arriba.</p>';
    return;
  }

  const latest = data[data.length - 1];
  const first = data[0];
  const painDelta = latest.pain - first.pain;
  const chairDelta = latest.chairStandCount - first.chairStandCount;
  const owdDelta = latest.owdCm - first.owdCm;
  const waistDelta = (latest.waistCm || 0) - (first.waistCm || 0);
  const neckDelta = (latest.neckCm || 0) - (first.neckCm || 0);

  function trendBadge(delta, invertBetter = false) {
    const improving = invertBetter ? delta > 0 : delta < 0;
    if (Math.abs(delta) < 0.5) return '<span class="outcome-trend trend-stable">Estable</span>';
    if (improving) return `<span class="outcome-trend trend-improving">Mejorando (${delta > 0 ? '+' : ''}${delta.toFixed(1)})</span>`;
    return `<span class="outcome-trend trend-worsening">Cambio (${delta > 0 ? '+' : ''}${delta.toFixed(1)})</span>`;
  }

  // WHtR risk interpretation
  const whtrRisk = latest.whtr
    ? (latest.whtr >= 0.5 ? '<span class="outcome-trend trend-worsening">Riesgo CV</span>' : '<span class="outcome-trend trend-improving">Normal</span>')
    : '';

  container.innerHTML = `
    <div class="tracking-card">
      <div class="tracking-title">Resultados funcionales</div>
      <div class="outcome-row">
        <span class="outcome-label">Dolor (VAS)</span>
        <span class="outcome-value">${latest.pain}/10</span>
        ${trendBadge(painDelta)}
      </div>
      <div class="outcome-row">
        <span class="outcome-label">Sentarse-Levantarse</span>
        <span class="outcome-value">${latest.chairStandCount}</span>
        ${trendBadge(chairDelta, true)}
      </div>
      <div class="outcome-row">
        <span class="outcome-label">Dist. Occipucio-Pared</span>
        <span class="outcome-value">${latest.owdCm} cm</span>
        ${trendBadge(owdDelta)}
      </div>
      <div class="outcome-row">
        <span class="outcome-label">Capacidad funcional</span>
        <span class="outcome-value">${latest.functionalCapacity || '-'}/5</span>
        ${data.length > 1 ? trendBadge((latest.functionalCapacity || 0) - (first.functionalCapacity || 0), true) : ''}
      </div>
    </div>

    <div class="tracking-card">
      <div class="tracking-title">Medidas antropometricas (Riesgo CV)</div>
      ${latest.waistCm ? `<div class="outcome-row">
        <span class="outcome-label">Perimetro abdominal</span>
        <span class="outcome-value">${latest.waistCm} cm</span>
        ${data.length > 1 && first.waistCm ? trendBadge(waistDelta) : ''}
      </div>` : ''}
      ${latest.whtr ? `<div class="outcome-row">
        <span class="outcome-label">Cintura/Altura (WHtR)</span>
        <span class="outcome-value">${latest.whtr}</span>
        ${whtrRisk}
      </div>` : ''}
      ${latest.neckCm ? `<div class="outcome-row">
        <span class="outcome-label">Perimetro de cuello</span>
        <span class="outcome-value">${latest.neckCm} cm</span>
        ${data.length > 1 && first.neckCm ? trendBadge(neckDelta) : ''}
      </div>` : ''}
      ${!latest.waistCm && !latest.neckCm ? '<p style="color:var(--color-text-light);">Agrega medidas antropometricas arriba para ver riesgo CV.</p>' : ''}
      <p style="font-size:12px;color:var(--color-text-light);margin-top:8px;">
        [GUIA-OFICIAL: IDF 2006, OMS 2008] | [TEXTO-REF: Ashwell 2012, JAMDA 2024]
      </p>
    </div>

    <p style="font-size:13px;color:var(--color-text-light);margin-top:8px;text-align:center;">
      ${data.length} medicion(es) | Semana ${latest.weekNumber || 1} |
      Primera: ${first.date}
    </p>
  `;
}

// ====== DATA EXPORT ======
function onExportData() {
  const profile = getUserProfile();
  const tracking = getTrackingData();
  const checkins = JSON.parse(localStorage.getItem('fenixfit_checkins') || '[]');

  // Build CSV
  let csv = 'EVIHEALTH - DATOS DE ESTUDIO\n';
  csv += `Exportado: ${new Date().toISOString()}\n`;
  csv += `ID Participante: ${profile?.participantId || 'N/A'}\n`;
  csv += `Edad: ${profile?.age || 'N/A'}\n`;
  csv += `Sexo: ${profile?.sex || 'N/A'}\n`;
  csv += `Condicion: ${profile?.condition || 'N/A'}\n`;
  csv += `Nivel actividad: ${profile?.activityLevel || 'N/A'}\n`;
  csv += `Fecha registro: ${profile?.registeredAt || 'N/A'}\n\n`;

  // Tracking data
  csv += 'MEDICIONES SEMANALES\n';
  csv += 'Fecha,Semana,Dolor_VAS,Chair_Stand_30s,OWD_cm,Perimetro_Abdominal_cm,Estatura_cm,WHtR,Perimetro_Cuello_cm,Capacidad_Funcional\n';
  tracking.forEach(t => {
    csv += `${t.date},${t.weekNumber},${t.pain},${t.chairStandCount},${t.owdCm},${t.waistCm || ''},${t.heightCm || ''},${t.whtr || ''},${t.neckCm || ''},${t.functionalCapacity || ''}\n`;
  });

  csv += '\nSESIONES DE EJERCICIO\n';
  csv += 'Fecha,Animo_Pre,Dolor,Ubicacion_Dolor,Tipo_Rutina,Ejercicios_Completados,Ejercicios_Total,Completado_Pct,Animo_Post\n';
  checkins.forEach(c => {
    csv += `${c.date},${c.mood},${c.painLevel},${c.painLocation},${c.routineType},${(c.exercisesCompleted || []).length},${c.totalExercises || 0},${c.completionPercent || 0},${c.postMood || ''}\n`;
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evihealth_${profile?.participantId || 'data'}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ====== ROUTINE GENERATION ======
function onGenerateRoutine() {
  const mood = getMood();
  const pain = getPain();
  const painLocation = getPainLocation();

  if (mood === null) {
    showScreen('screen-checkin-mood');
    return;
  }

  const yesterdayIds = getYesterdayExerciseIds();
  currentRoutine = generateRoutine(mood, pain, painLocation, yesterdayIds);
  currentExerciseIndex = 0;
  completedIds = [];
  skippedIds = [];

  renderRoutineScreen();
  showScreen('screen-routine');
}

function renderRoutineScreen() {
  if (!currentRoutine) return;

  const header = document.getElementById('routine-header');
  const list = document.getElementById('routine-list');
  const profile = getUserProfile();

  // Show age-based recommendation if available
  let ageInfo = '';
  if (profile) {
    const rec = getAgeRecommendation(profile.age, profile.activityLevel);
    ageInfo = `<div class="evidence-info-banner" style="text-align:left;margin-top:12px;">
      <strong>Recomendacion para su perfil (${profile.age} anos):</strong>
      ${rec.note}<br>
      <span style="font-size:13px;">[GUIA-OFICIAL: ${rec.source}]</span>
    </div>`;
  }

  if (header) {
    header.innerHTML = `
      <span class="routine-type-badge ${currentRoutine.cssClass}">
        ${currentRoutine.emoji} Rutina ${currentRoutine.name}
      </span>
      <div class="routine-meta">~${currentRoutine.duration} minutos - ${currentRoutine.exercises.length} ejercicios</div>
      <div class="routine-message">${currentRoutine.message}</div>
      ${ageInfo}
    `;
  }

  if (list) {
    let currentBlock = '';
    list.innerHTML = currentRoutine.exercises.map((ex, i) => {
      let blockHeader = '';
      if (ex.blockLabel !== currentBlock) {
        currentBlock = ex.blockLabel;
        blockHeader = `<h3 style="margin-top:16px;margin-bottom:8px;">${currentBlock}</h3>`;
      }

      return `
        ${blockHeader}
        <div class="exercise-card">
          <span class="exercise-card-number">${i + 1}</span>
          <div class="exercise-card-info">
            <div class="exercise-card-name">${ex.name}</div>
            <div class="exercise-card-meta">${ex.reps} - ${formatDuration(ex.durationSeconds)}</div>
          </div>
          ${createEvidenceBadgeHTML(ex.evidence)}
        </div>
      `;
    }).join('');
  }
}

// ====== EXERCISE PLAYER ======
function startRoutine() {
  if (!currentRoutine || currentRoutine.exercises.length === 0) return;
  currentExerciseIndex = 0;
  routineStartTime = Date.now();
  renderExercise();
  showScreen('screen-exercise');
}

function renderExercise() {
  if (!currentRoutine) return;
  const ex = currentRoutine.exercises[currentExerciseIndex];
  if (!ex) return;

  const total = currentRoutine.exercises.length;
  const progress = document.getElementById('exercise-progress');
  const name = document.getElementById('exercise-name');
  const video = document.getElementById('exercise-video');
  const evidenceContainer = document.getElementById('exercise-evidence');
  const reps = document.getElementById('exercise-reps');
  const equipment = document.getElementById('exercise-equipment');
  const instructions = document.getElementById('exercise-instructions');

  if (progress) {
    const pct = ((currentExerciseIndex + 1) / total * 100).toFixed(0);
    progress.innerHTML = `
      Ejercicio ${currentExerciseIndex + 1} de ${total}
      <div class="exercise-progress-bar">
        <div class="exercise-progress-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  if (name) name.textContent = ex.name;

  if (video) {
    if (ex.media && ex.media.videoId) {
      video.innerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${ex.media.videoId}?rel=0&modestbranding=1"
          title="${ex.name}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          loading="lazy"
        ></iframe>
      `;
    } else {
      video.innerHTML = `<div class="video-placeholder">Video no disponible</div>`;
    }
  }

  if (evidenceContainer) {
    evidenceContainer.innerHTML = '';
    evidenceContainer.appendChild(createEvidenceBadge(ex.evidence, ex.name));
  }

  if (reps) reps.innerHTML = `\u{1F504} ${ex.reps}`;
  if (equipment) equipment.innerHTML = `\u{1FA91} ${ex.equipment}`;

  if (instructions) {
    instructions.innerHTML = ex.instructions.map((step, i) => `
      <div class="instruction-step">
        <span class="step-number">${i + 1}</span>
        <span>${step}</span>
      </div>
    `).join('');
  }

  const btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.textContent = currentExerciseIndex < total - 1 ? 'Siguiente' : 'Finalizar';
  }
}

function nextExercise() {
  if (!currentRoutine) return;
  completedIds.push(currentRoutine.exercises[currentExerciseIndex].id);

  if (currentExerciseIndex < currentRoutine.exercises.length - 1) {
    currentExerciseIndex++;
    renderExercise();
    window.scrollTo(0, 0);
  } else {
    finishRoutine();
  }
}

function skipExercise() {
  if (!currentRoutine) return;
  skippedIds.push(currentRoutine.exercises[currentExerciseIndex].id);

  if (currentExerciseIndex < currentRoutine.exercises.length - 1) {
    currentExerciseIndex++;
    renderExercise();
    window.scrollTo(0, 0);
  } else {
    finishRoutine();
  }
}

function finishRoutine() {
  const mood = getMood();
  const pain = getPain();
  const painLocation = getPainLocation();

  const total = currentRoutine.exercises.length;
  const completionPercent = Math.round((completedIds.length / total) * 100);

  const durationMinutes = routineStartTime
    ? Math.round((Date.now() - routineStartTime) / 60000)
    : 0;

  // Build exercise details for Supabase
  const exerciseDetails = currentRoutine.exercises.map(ex => ({
    id: ex.id,
    name: ex.name,
    category: ex.category,
    reps: ex.reps,
    completed: completedIds.includes(ex.id),
    skipped: skippedIds.includes(ex.id)
  }));

  const sessionData = {
    mood,
    pain,
    painLocation,
    routineType: currentRoutine.type,
    completedIds,
    skippedIds,
    completionPercent,
    totalExercises: total,
    durationMinutes,
    exerciseDetails
  };

  saveSession(sessionData);

  // Send to Supabase
  const profile = getUserProfile();
  if (profile) {
    saveExerciseSession(profile.participantId, sessionData).then(result => {
      if (result.ok) console.log('Sesion + ejercicios enviados a Supabase');
      else console.warn('Error enviando a Supabase:', result.error);
    });
  }

  const msg = document.getElementById('completion-message');
  if (msg) {
    const messages = [
      'Completaste tu rutina de hoy!',
      `${completedIds.length} de ${total} ejercicios realizados.`,
    ];
    if (skippedIds.length > 0) {
      messages.push(`Saltaste ${skippedIds.length} ejercicio(s). Esta bien!`);
    }
    msg.innerHTML = messages.join('<br>');
  }

  const streak = getStreak();
  const streakCount = document.getElementById('streak-count');
  if (streakCount) streakCount.textContent = streak.current;

  showScreen('screen-completed');
}

function savePostMood(postMood) {
  try {
    const checkins = JSON.parse(localStorage.getItem('fenixfit_checkins')) || [];
    const today = new Date().toISOString().split('T')[0];
    const record = checkins.find(c => c.date === today);
    if (record) {
      record.postMood = postMood;
      localStorage.setItem('fenixfit_checkins', JSON.stringify(checkins));
    }
  } catch (e) {
    console.error('Error saving post mood:', e);
  }
}

// ====== INITIALIZATION ======
async function init() {
  await loadExercises();
  initCheckin();
  initRegistration();
  initTracking();
  restoreNightMode();

  // Welcome button — go to register if new, check-in if returning
  const btnWelcome = document.getElementById('btn-welcome-start');
  if (btnWelcome) {
    btnWelcome.addEventListener('click', () => {
      if (isRegistered()) {
        showScreen('screen-checkin-mood');
      } else {
        showScreen('screen-register');
      }
    });
  }

  // Wire up buttons
  const btnGenerate = document.getElementById('btn-generate-routine');
  if (btnGenerate) btnGenerate.addEventListener('click', onGenerateRoutine);

  const btnStart = document.getElementById('btn-start-routine');
  if (btnStart) btnStart.addEventListener('click', startRoutine);

  const btnNext = document.getElementById('btn-next');
  if (btnNext) btnNext.addEventListener('click', nextExercise);

  const btnSkip = document.getElementById('btn-skip');
  if (btnSkip) btnSkip.addEventListener('click', skipExercise);

  // Post-pain slider
  const postPainSlider = document.getElementById('post-pain-slider');
  const postPainDisplay = document.getElementById('post-pain-value');
  if (postPainSlider && postPainDisplay) {
    postPainSlider.addEventListener('input', () => {
      const v = parseInt(postPainSlider.value);
      postPainDisplay.textContent = v;
      postPainDisplay.className = 'pain-number';
      if (v <= 3) postPainDisplay.classList.add('pain-low');
      else if (v <= 6) postPainDisplay.classList.add('pain-mid');
      else postPainDisplay.classList.add('pain-high');
    });
  }

  // Close modal on backdrop click
  const modal = document.getElementById('evidence-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Expose global API for inline handlers
  window.FenixFit = {
    showScreen,
    closeModal,
    savePostMood,
    toggleNightMode
  };
}

// Start the app
init();
