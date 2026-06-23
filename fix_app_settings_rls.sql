-- ==========================================
-- FIX RLS: app_settings
-- Jalankan di Supabase SQL Editor
-- ==========================================

-- Hapus policy lama yang memblokir karena mac_address IS NULL
DROP POLICY IF EXISTS "Izinkan semua akses" ON public.app_settings;
DROP POLICY IF EXISTS owner_settings_access ON public.app_settings;

-- Policy SELECT: user authenticated bisa baca settings milik perangkatnya
-- ATAU baris lama yang mac_address-nya masih NULL (id=1 default)
CREATE POLICY owner_settings_select ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    mac_address IS NULL
    OR mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Policy UPDATE: user authenticated bisa update settings
-- Sama: izinkan juga baris dengan mac_address NULL agar toggle bisa bekerja
CREATE POLICY owner_settings_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (
    mac_address IS NULL
    OR mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    mac_address IS NULL
    OR mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Policy INSERT: izinkan authenticated untuk insert (misal baris pertama belum ada)
CREATE POLICY owner_settings_insert ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Pastikan baris id=1 sudah ada dengan mac_address dari device yang terdaftar
-- Jalankan query ini untuk mengisi mac_address pada baris id=1:
-- UPDATE public.app_settings
--   SET mac_address = (
--     SELECT mac_address FROM public.devices
--     WHERE owner_id = auth.uid()
--     LIMIT 1
--   )
--   WHERE id = 1;
--
-- Atau jika ingin set manual dengan MAC address yang diketahui:
-- UPDATE public.app_settings
--   SET mac_address = '40:4C:CA:55:1D:18'
--   WHERE id = 1;
