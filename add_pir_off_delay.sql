-- ============================================================
-- Tambah kolom pir_off_delay ke app_settings
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Tambah kolom durasi timeout PIR (dalam menit), default 10 menit
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS pir_off_delay integer DEFAULT 10;

-- Set nilai default pada baris yang sudah ada
UPDATE app_settings
SET pir_off_delay = 10
WHERE pir_off_delay IS NULL;
