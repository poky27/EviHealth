-- =============================================
-- EviHealth — Fix: agregar campos faltantes + tabla ejercicios_completados
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Agregar campos faltantes a exercise_sessions
ALTER TABLE exercise_sessions
  ADD COLUMN IF NOT EXISTS pain_after INTEGER CHECK (pain_after BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0;

-- 2. Crear tabla ejercicios_completados (detalle por ejercicio por sesion)
CREATE TABLE IF NOT EXISTS ejercicios_completados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  category TEXT,
  reps TEXT,
  completed BOOLEAN DEFAULT true,
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Permisos para la nueva tabla
ALTER TABLE ejercicios_completados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert ejercicios" ON ejercicios_completados
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select ejercicios" ON ejercicios_completados
  FOR SELECT TO anon USING (true);

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_ejercicios_session ON ejercicios_completados(session_id);
CREATE INDEX IF NOT EXISTS idx_ejercicios_exercise ON ejercicios_completados(exercise_id);
