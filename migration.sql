-- ==========================================
-- MIGRATION MIGRATION UNTUK DEVICE PAIRING (MULTI-USER)
-- Jalankan skrip ini di Supabase SQL Editor
-- ==========================================

-- 1. Buat Tabel Devices
CREATE TABLE IF NOT EXISTS public.devices (
  mac_address TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paired_at TIMESTAMP WITH TIME ZONE,
  last_ip TEXT,
  status TEXT DEFAULT 'offline',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS pada Devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Buat Kebijakan RLS untuk Devices
-- Pengguna dapat melihat & mengedit alat milik mereka
CREATE POLICY user_device_policy ON public.devices
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Izinkan pembacaan perangkat yang belum berpasangan (unpaired) untuk Auto-Discovery
CREATE POLICY discover_unpaired ON public.devices
  FOR SELECT TO authenticated
  USING (owner_id IS NULL);

-- Izinkan API pendaftaran menyisipkan/mengupdate perangkat secara publik
CREATE POLICY public_insert_policy ON public.devices
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

CREATE POLICY public_update_policy ON public.devices
  FOR UPDATE TO anon, authenticated, service_role
  USING (true);


-- 2. Modifikasi Tabel Sensor Data
-- Tambahkan kolom mac_address ke sensor_data
ALTER TABLE public.sensor_data 
  ADD COLUMN IF NOT EXISTS mac_address TEXT REFERENCES public.devices(mac_address) ON DELETE SET NULL;

-- 3. Modifikasi Tabel Device Commands
-- Tambahkan kolom mac_address ke device_commands
ALTER TABLE public.device_commands 
  ADD COLUMN IF NOT EXISTS mac_address TEXT REFERENCES public.devices(mac_address) ON DELETE SET NULL;

-- 4. Modifikasi Tabel App Settings
-- Tambahkan kolom mac_address ke app_settings
ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS mac_address TEXT REFERENCES public.devices(mac_address) ON DELETE SET NULL;

-- 5. Aktifkan RLS di Tabel sensor_data, device_commands, dan app_settings
ALTER TABLE public.sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 6. Buat Kebijakan RLS agar user hanya bisa mengakses data sensor & perintah untuk perangkat miliknya
-- Kebijakan RLS untuk sensor_data
CREATE POLICY owner_sensor_access ON public.sensor_data
  FOR ALL TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Kebijakan RLS untuk device_commands
CREATE POLICY owner_command_access ON public.device_commands
  FOR ALL TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- Kebijakan RLS untuk app_settings
CREATE POLICY owner_settings_access ON public.app_settings
  FOR ALL TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );
