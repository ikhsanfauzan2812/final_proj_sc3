-- ============================================================
-- Setup untuk Autopilot Engine
-- Jalankan di Supabase SQL Editor sebelum deploy Edge Function
-- ============================================================

-- 1. Tambah kolom mac_address ke app_settings (jika belum ada)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS mac_address text;

-- 2. Update baris existing dengan mac_address dari devices yang sudah paired
-- (Jalankan setelah perangkat ter-pair)
-- UPDATE app_settings SET mac_address = '<MAC_ADDRESS_KAMU>' WHERE id = 1;

-- 3. Tambah kolom last_comfort_status untuk tracking perubahan kondisi
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS last_comfort_status text DEFAULT 'Menganalisis';

ALTER TABLE app_settings  
ADD COLUMN IF NOT EXISTS last_command_at timestamp with time zone;

-- 4. Buat tabel autopilot_log untuk mencatat setiap keputusan autopilot
-- (Berguna untuk analisis di sub-bab 4.3 skripsi)
CREATE TABLE IF NOT EXISTS autopilot_log (
  id bigserial PRIMARY KEY,
  mac_address text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  temperature float,
  humidity float,
  voc float,
  pir integer,
  comfort_status text NOT NULL,           -- Nyaman / Kurang Nyaman / Tidak Nyaman
  ac_command text NOT NULL,               -- SET_AC payload JSON
  no_motion_minutes float DEFAULT 0,
  action_taken text                       -- 'command_sent' / 'skipped_identical' / 'ac_off'
);

-- Enable RLS
ALTER TABLE autopilot_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON autopilot_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON autopilot_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index untuk query performa
CREATE INDEX IF NOT EXISTS idx_autopilot_log_mac ON autopilot_log(mac_address);
CREATE INDEX IF NOT EXISTS idx_autopilot_log_created ON autopilot_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_log_comfort ON autopilot_log(comfort_status);
