-- ==========================================
-- FIX RLS + BACKFILL MAC ADDRESS
-- Jalankan skrip ini di Supabase SQL Editor
-- ==========================================

-- ============================================================
-- BAGIAN 1: PERBAIKI RLS sensor_data
-- Masalah: Policy lama memblokir:
--   (a) INSERT dari ESP32 (anon key) karena tidak ada policy anon
--   (b) SELECT/UPDATE data lama yang mac_address-nya NULL
-- ============================================================

-- Hapus policy lama yang terlalu ketat
DROP POLICY IF EXISTS owner_sensor_access ON public.sensor_data;

-- Policy baru: izinkan ESP32 (anon) INSERT data sensor
CREATE POLICY anon_insert_sensor ON public.sensor_data
  FOR INSERT TO anon, service_role
  WITH CHECK (true);

-- Policy baru: user authenticated hanya bisa SELECT data milik perangkatnya
-- Termasuk data lama yang mac_address-nya NULL (agar bisa di-backfill)
CREATE POLICY owner_sensor_select ON public.sensor_data
  FOR SELECT TO authenticated
  USING (
    mac_address IS NULL
    OR mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Policy baru: user authenticated bisa UPDATE (untuk backfill mac_address)
CREATE POLICY owner_sensor_update ON public.sensor_data
  FOR UPDATE TO authenticated
  USING (
    mac_address IS NULL
    OR mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Policy: izinkan DELETE untuk data milik perangkat sendiri
CREATE POLICY owner_sensor_delete ON public.sensor_data
  FOR DELETE TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );


-- ============================================================
-- BAGIAN 2: BACKFILL mac_address PADA DATA LAMA
-- Device yang terdaftar di tabel devices: ESP32-C6-DEMO
-- Update semua baris sensor_data yang mac_address-nya NULL
-- ============================================================

-- Backfill semua data lama (mac_address IS NULL) dengan device yang ter-pair
UPDATE public.sensor_data
  SET mac_address = 'ESP32-C6-DEMO'
  WHERE mac_address IS NULL;

-- Verifikasi hasil backfill:
-- SELECT COUNT(*) as total_null FROM public.sensor_data WHERE mac_address IS NULL;
-- SELECT COUNT(*) as total_demo FROM public.sensor_data WHERE mac_address = 'ESP32-C6-DEMO';


-- ============================================================
-- BAGIAN 3: AKTIFKAN REALTIME UNTUK sensor_data (jika belum)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_data;


-- ============================================================
-- BAGIAN 5: MIGRASI KE MAC ADDRESS FISIK ESP32 (OPSIONAL TAPI DIREKOMENDASIKAN)
-- 
-- Saat ini device terdaftar sebagai 'ESP32-C6-DEMO' (demo mode).
-- ESP32 fisik mengirim data dengan MAC address aslinya (misal: 40:4C:CA:XX:XX:XX).
-- Agar data baru dari ESP32 fisik masuk ke dashboard, ada dua opsi:
--
-- OPSI A (Mudah): Update mac_address di tabel devices dari 'ESP32-C6-DEMO'
--                 ke MAC address fisik ESP32.
--                 Lihat MAC address di Serial Monitor saat ESP32 boot.
--
--   UPDATE public.devices
--     SET mac_address = '40:4C:CA:XX:XX:XX'   -- ganti dengan MAC fisik ESP32
--     WHERE mac_address = 'ESP32-C6-DEMO';
--
--   UPDATE public.sensor_data
--     SET mac_address = '40:4C:CA:XX:XX:XX'   -- ganti dengan MAC fisik ESP32
--     WHERE mac_address = 'ESP32-C6-DEMO';
--
-- OPSI B (Bersih): Unpair 'ESP32-C6-DEMO' dari dashboard, nyalakan ESP32 fisik,
--                  biarkan auto-discovery mendeteksi MAC address aslinya,
--                  lalu pair ulang dari banner di dashboard.
-- ============================================================
