-- ============================================================
-- Setup Database Webhook untuk Autopilot Engine
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Enable pg_net extension (diperlukan untuk HTTP calls dari database)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Buat fungsi trigger yang akan memanggil Edge Function
CREATE OR REPLACE FUNCTION trigger_autopilot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Ambil URL Supabase dari environment (ganti dengan URL project kamu)
  edge_function_url := current_setting('app.supabase_url', true) || '/functions/v1/autopilot-engine';
  service_role_key := current_setting('app.service_role_key', true);

  -- Panggil Edge Function secara async (non-blocking)
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

-- 3. Buat trigger pada tabel sensor_data
DROP TRIGGER IF EXISTS on_sensor_data_insert ON sensor_data;
CREATE TRIGGER on_sensor_data_insert
  AFTER INSERT ON sensor_data
  FOR EACH ROW
  EXECUTE FUNCTION trigger_autopilot();

-- ============================================================
-- ALTERNATIF: Gunakan Supabase Dashboard Webhook
-- Jika pg_net tidak tersedia, buat webhook via:
-- Dashboard → Database → Webhooks → Create new webhook
-- Table: sensor_data
-- Events: INSERT
-- URL: https://<project-ref>.supabase.co/functions/v1/autopilot-engine
-- HTTP Headers: Authorization: Bearer <service_role_key>
-- ============================================================
