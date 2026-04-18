-- Buat tabel app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_mode boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Pastikan hanya ada 1 baris pengaturan (ID = 1)
INSERT INTO app_settings (id, auto_mode)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Aktifkan Realtime untuk app_settings agar web langsung ter-update jika diubah
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;

-- Izinkan akses publik (jika RLS aktif)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Izinkan semua akses" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);
