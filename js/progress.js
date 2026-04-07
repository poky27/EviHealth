// progress.js — LocalStorage CRUD, streaks, history

const STORAGE_KEY_CHECKINS = 'fenixfit_checkins';
const STORAGE_KEY_STREAK = 'fenixfit_streak';

function getCheckins() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKINS)) || [];
  } catch {
    return [];
  }
}

function saveCheckins(checkins) {
  localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(checkins));
}

function getStreakData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK)) || { current: 0, best: 0, lastDate: null };
  } catch {
    return { current: 0, best: 0, lastDate: null };
  }
}

function saveStreakData(data) {
  localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(data));
}

export function saveSession(sessionData) {
  const checkins = getCheckins();
  const today = new Date().toISOString().split('T')[0];

  const record = {
    date: today,
    timestamp: Date.now(),
    mood: sessionData.mood,
    painLevel: sessionData.pain,
    painLocation: sessionData.painLocation,
    routineType: sessionData.routineType,
    exercisesCompleted: sessionData.completedIds || [],
    exercisesSkipped: sessionData.skippedIds || [],
    completionPercent: sessionData.completionPercent || 100,
    postMood: sessionData.postMood || null,
    totalExercises: sessionData.totalExercises || 0
  };

  // Replace today's record if exists, otherwise append
  const existingIdx = checkins.findIndex(c => c.date === today);
  if (existingIdx >= 0) {
    checkins[existingIdx] = record;
  } else {
    checkins.push(record);
  }

  // Keep last 90 days max
  const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
  const trimmed = checkins.filter(c => c.timestamp > cutoff);
  saveCheckins(trimmed);

  // Update streak
  updateStreak(today);

  return record;
}

function updateStreak(todayStr) {
  const streak = getStreakData();
  const today = new Date(todayStr);
  const lastDate = streak.lastDate ? new Date(streak.lastDate) : null;

  if (!lastDate) {
    streak.current = 1;
  } else {
    const diffDays = Math.floor((today - lastDate) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      // Same day, no change
    } else if (diffDays === 1) {
      streak.current += 1;
    } else if (diffDays === 2) {
      // Grace day (1 day off allowed)
      streak.current += 1;
    } else {
      streak.current = 1;
    }
  }

  streak.lastDate = todayStr;
  if (streak.current > streak.best) {
    streak.best = streak.current;
  }

  saveStreakData(streak);
  return streak;
}

export function getStreak() {
  return getStreakData();
}

export function getRecentCheckins(days = 7) {
  const checkins = getCheckins();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return checkins
    .filter(c => c.timestamp > cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getTotalSessions() {
  return getCheckins().length;
}

export function getYesterdayExerciseIds() {
  const checkins = getCheckins();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  const record = checkins.find(c => c.date === yStr);
  return record ? record.exercisesCompleted : [];
}

export function getStats() {
  const checkins = getCheckins();
  const streak = getStreakData();
  const recent = getRecentCheckins(7);

  const totalSessions = checkins.length;
  const avgMood = recent.length > 0
    ? (recent.reduce((sum, c) => sum + c.mood, 0) / recent.length).toFixed(1)
    : '-';
  const avgPain = recent.length > 0
    ? (recent.reduce((sum, c) => sum + c.painLevel, 0) / recent.length).toFixed(1)
    : '-';

  return {
    totalSessions,
    currentStreak: streak.current,
    bestStreak: streak.best,
    avgMood,
    avgPain,
    recentSessions: recent
  };
}

export function renderProgressScreen() {
  const stats = getStats();

  // Stats cards
  const statsContainer = document.getElementById('progress-stats');
  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.currentStreak}</div>
        <div class="stat-label">Racha actual</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalSessions}</div>
        <div class="stat-label">Sesiones totales</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgMood}</div>
        <div class="stat-label">Animo promedio (7d)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgPain}</div>
        <div class="stat-label">Dolor promedio (7d)</div>
      </div>
    `;
  }

  // Chart
  renderChart(stats.recentSessions);

  // History
  const historyContainer = document.getElementById('progress-history');
  if (historyContainer) {
    if (stats.recentSessions.length === 0) {
      historyContainer.innerHTML = '<p style="text-align:center;color:var(--color-text-light);">Aun no hay registros. Haz tu primer check-in!</p>';
    } else {
      const moodEmojis = ['', '\u{1F61E}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F604}'];
      historyContainer.innerHTML = stats.recentSessions.map(s => `
        <div class="history-item">
          <div>
            <div class="history-date">${formatDate(s.date)}</div>
            <div class="history-detail">${s.routineType} - Dolor: ${s.painLevel}/10</div>
          </div>
          <span class="history-mood">${moodEmojis[s.mood] || ''}</span>
        </div>
      `).join('');
    }
  }
}

function renderChart(sessions) {
  const container = document.getElementById('progress-chart');
  if (!container || sessions.length === 0) {
    if (container) container.innerHTML = '<p style="text-align:center;color:var(--color-text-light);padding:40px 0;">Completa algunos dias para ver tu grafico.</p>';
    return;
  }

  const width = 360;
  const height = 140;
  const padding = 30;

  const reversed = [...sessions].reverse(); // oldest first
  const maxPoints = Math.min(reversed.length, 7);
  const data = reversed.slice(-maxPoints);

  const xStep = (width - padding * 2) / Math.max(data.length - 1, 1);

  function pointsToPath(values, maxVal) {
    return values.map((v, i) => {
      const x = padding + i * xStep;
      const y = height - padding - ((v / maxVal) * (height - padding * 2));
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }

  const moodValues = data.map(d => d.mood);
  const painValues = data.map(d => d.painLevel);

  const moodPath = pointsToPath(moodValues, 5);
  const painPath = pointsToPath(painValues, 10);

  const labels = data.map((d, i) => {
    const x = padding + i * xStep;
    const date = new Date(d.date + 'T12:00:00');
    const day = date.toLocaleDateString('es', { weekday: 'short' });
    return `<text x="${x}" y="${height - 5}" text-anchor="middle" font-size="11" fill="#6b7280">${day}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;">
      <path d="${moodPath}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${painPath}" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 4"/>
      ${labels}
      <text x="${width - padding}" y="16" text-anchor="end" font-size="11" fill="#3b82f6">Animo</text>
      <text x="${width - padding}" y="30" text-anchor="end" font-size="11" fill="#ef4444">Dolor</text>
    </svg>
  `;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
}
