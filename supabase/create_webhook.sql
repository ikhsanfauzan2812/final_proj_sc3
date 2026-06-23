-- ============================================================
-- Buat webhook via supabase_functions.http_request
-- Jalankan di: https://supabase.com/dashboard/project/inzarwaoykzztuopayaq/sql/new
-- ============================================================

-- Enable extension pg_net jika belum ada
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Buat fungsi trigger
CREATE OR REPLACE FUNCTION public.trigger_autopilot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM
    net.http_post(
      url     := 'https://inzarwaoykzztuopayaq.supabase.co/functions/v1/autopilot-engine',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body    := jsonb_build_object(
        'type',   'INSERT',
        'record', row_to_json(NEW)
      )
    );
  RETURN NEW;
END;
$$;

-- Hapus trigger lama jika ada
DROP TRIGGER IF EXISTS on_sensor_data_autopilot ON public.sensor_data;

-- Buat trigger baru
CREATE TRIGGER on_sensor_data_autopilot
  AFTER INSERT ON public.sensor_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_autopilot();
