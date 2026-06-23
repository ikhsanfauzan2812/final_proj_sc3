-- ==========================================
-- FIX RLS: device_commands
-- Jalankan di Supabase SQL Editor
-- ==========================================

-- Pastikan RLS aktif di tabel ini
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS owner_insert_commands ON public.device_commands;
DROP POLICY IF EXISTS owner_select_commands ON public.device_commands;
DROP POLICY IF EXISTS owner_update_commands ON public.device_commands;
DROP POLICY IF EXISTS anon_select_commands ON public.device_commands;
DROP POLICY IF EXISTS anon_update_commands ON public.device_commands;

-- 1. User authenticated boleh INSERT command ke perangkat miliknya
CREATE POLICY owner_insert_commands ON public.device_commands
  FOR INSERT TO authenticated
  WITH CHECK (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- 2. User authenticated boleh SELECT command milik perangkatnya
CREATE POLICY owner_select_commands ON public.device_commands
  FOR SELECT TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- 3. User authenticated boleh UPDATE (misal cancel command)
CREATE POLICY owner_update_commands ON public.device_commands
  FOR UPDATE TO authenticated
  USING (
    mac_address IN (
      SELECT mac_address FROM public.devices WHERE owner_id = auth.uid()
    )
  );

-- 4. ESP32 (anon) boleh SELECT command yang pending miliknya
CREATE POLICY anon_select_commands ON public.device_commands
  FOR SELECT TO anon
  USING (status = 'pending');

-- 5. ESP32 (anon) boleh UPDATE status command ke 'executed'
CREATE POLICY anon_update_commands ON public.device_commands
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (status = 'executed');
