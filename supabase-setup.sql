-- =============================================
-- EviHealth — Supabase Database Setup
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. PARTICIPANTES
CREATE TABLE IF NOT EXISTS participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id TEXT UNIQUE NOT NULL,
  name TEXT,
  age INTEGER NOT NULL CHECK (age >= 18 AND age <= 120),
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  condition TEXT NOT NULL,
  activity_level TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SESIONES DE EJERCICIO
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(participant_id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_pre INTEGER CHECK (mood_pre BETWEEN 1 AND 5),
  pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  pain_location TEXT,
  routine_type TEXT,
  exercises_completed INTEGER DEFAULT 0,
  exercises_total INTEGER DEFAULT 0,
  completion_pct INTEGER DEFAULT 0,
  mood_post INTEGER CHECK (mood_post BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEDICIONES SEMANALES (Outcomes clinicos)
CREATE TABLE IF NOT EXISTS weekly_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(participant_id),
  tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  week_number INTEGER NOT NULL,
  pain_vas INTEGER CHECK (pain_vas BETWEEN 0 AND 10),
  chair_stand_count INTEGER DEFAULT 0,
  owd_cm NUMERIC(4,1) DEFAULT 0,
  functional_capacity INTEGER CHECK (functional_capacity BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PERMISOS (Row Level Security)
-- Permitir que la app inserte y lea datos con anon key

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_tracking ENABLE ROW LEVEL SECURITY;

-- Politicas: cualquiera con anon key puede insertar y leer
CREATE POLICY "Allow anon insert participants" ON participants
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select participants" ON participants
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert sessions" ON exercise_sessions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select sessions" ON exercise_sessions
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert tracking" ON weekly_tracking
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select tracking" ON weekly_tracking
  FOR SELECT TO anon USING (true);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON exercise_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_tracking_participant ON weekly_tracking(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON exercise_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_tracking_date ON weekly_tracking(tracking_date);
