const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://inzarwaoykzztuopayaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluemFyd2FveWt6enR1b3BheWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDE2MzcsImV4cCI6MjA5MTk3NzYzN30.iZLvGzqjo98RBM5Xb4K-A924jqCdfKX7jSKXnVwk6F0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking if there are any devices...");
  const { data: devices, error: devErr } = await supabase
    .from('devices')
    .select('*');
  if (devErr) console.error("Dev err:", devErr);
  else console.log("Devices:", JSON.stringify(devices, null, 2));

  console.log("\nChecking for sensor data with mac_address = 'ESP32-C6-DEMO'...");
  const { data: demoData, error: demoErr } = await supabase
    .from('sensor_data')
    .select('*')
    .eq('mac_address', 'ESP32-C6-DEMO')
    .order('created_at', { ascending: false })
    .limit(5);
  if (demoErr) console.error("Demo err:", demoErr);
  else console.log("Demo sensor data:", JSON.stringify(demoData, null, 2));

  console.log("\nChecking for any sensor data with non-null mac_address...");
  const { data: nonNullData, error: nonNullErr } = await supabase
    .from('sensor_data')
    .select('*')
    .not('mac_address', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (nonNullErr) console.error("NonNull err:", nonNullErr);
  else console.log("NonNull sensor data:", JSON.stringify(nonNullData, null, 2));
}

main();
