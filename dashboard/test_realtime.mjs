import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE URL or KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Menghubungkan ke Supabase Realtime...");

const channel = supabase
  .channel('test_sensor_data')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'sensor_data' },
    (payload) => {
      console.log("✅ DATA BARU DITERIMA VIA REALTIME:", payload.new);
    }
  )
  .subscribe((status) => {
    console.log("Status Koneksi Realtime:", status);
  });

// Keep process alive
setInterval(() => {}, 1000);
