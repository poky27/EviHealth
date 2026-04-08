// supabase.js — Conexion a Supabase para envio automatico de datos

const SUPABASE_URL = 'https://fqmrkmbevytferzmuqfx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbXJrbWJldnl0ZmVyem11cWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTM2ODksImV4cCI6MjA5MTE2OTY4OX0.Kh1DtGwtIYUyE_OMXC_P2NB261yUF9zu7O7AgCNqoPs';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function supabasePost(table, data) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Supabase error (${table}):`, error);
      return { ok: false, error };
    }

    const result = await response.json().catch(() => null);
    return { ok: true, data: result };
  } catch (err) {
    console.error(`Supabase network error (${table}):`, err.message);
    return { ok: false, error: err.message };
  }
}

async function supabaseGet(table, query = '') {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      return { ok: false, data: [] };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    console.error(`Supabase fetch error (${table}):`, err.message);
    return { ok: false, data: [] };
  }
}

// ====== PUBLIC API ======

export async function registerParticipant(profile) {
  return supabasePost('participants', {
    participant_id: profile.participantId,
    name: profile.name,
    age: profile.age,
    sex: profile.sex,
    condition: profile.condition,
    activity_level: profile.activityLevel
  });
}

export async function saveExerciseSession(participantId, session) {
  const result = await supabasePost('exercise_sessions', {
    participant_id: participantId,
    session_date: session.date || new Date().toISOString().split('T')[0],
    mood_pre: session.mood,
    pain_level: session.pain,
    pain_after: session.painAfter || null,
    pain_location: session.painLocation,
    routine_type: session.routineType,
    exercises_completed: (session.completedIds || []).length,
    exercises_total: session.totalExercises || 0,
    completion_pct: session.completionPercent || 0,
    mood_post: session.postMood || null,
    duration_minutes: session.durationMinutes || 0
  });

  // Si la sesion se guardo, guardar detalle de ejercicios
  if (result.ok && result.data && result.data[0]) {
    const sessionId = result.data[0].id;
    await saveExerciseDetails(sessionId, session.exerciseDetails || []);
  }

  return result;
}

export async function saveExerciseDetails(sessionId, exercises) {
  if (!exercises || exercises.length === 0) return { ok: true };

  const rows = exercises.map(ex => ({
    session_id: sessionId,
    exercise_id: ex.id,
    exercise_name: ex.name,
    category: ex.category,
    reps: ex.reps,
    completed: ex.completed !== false,
    skipped: ex.skipped === true
  }));

  return supabasePost('ejercicios_completados', rows);
}

export async function saveWeeklyTracking(participantId, tracking) {
  return supabasePost('weekly_tracking', {
    participant_id: participantId,
    tracking_date: tracking.date || new Date().toISOString().split('T')[0],
    week_number: tracking.weekNumber,
    pain_vas: tracking.pain,
    chair_stand_count: tracking.chairStandCount,
    owd_cm: tracking.owdCm,
    waist_cm: tracking.waistCm || null,
    height_cm: tracking.heightCm || null,
    neck_cm: tracking.neckCm || null,
    whtr: tracking.whtr || null,
    functional_capacity: tracking.functionalCapacity
  });
}

export async function getParticipantSessions(participantId) {
  return supabaseGet('exercise_sessions', `participant_id=eq.${participantId}&order=session_date.desc`);
}

export async function getParticipantTracking(participantId) {
  return supabaseGet('weekly_tracking', `participant_id=eq.${participantId}&order=tracking_date.desc`);
}

export async function testConnection() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/participants?select=count&limit=0`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}
