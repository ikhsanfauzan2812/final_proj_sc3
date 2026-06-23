const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://inzarwaoykzztuopayaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluemFyd2FveWt6enR1b3BheWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDE2MzcsImV4cCI6MjA5MTk3NzYzN30.iZLvGzqjo98RBM5Xb4K-A924jqCdfKX7jSKXnVwk6F0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching devices...");
  const { data: devices, error: devErr } = await supabase
    .from('devices')
    .select('*');
  if (devErr) console.error("Dev err:", devErr);
  else console.log("Devices:", JSON.stringify(devices, null, 2));

  console.log("\nFetching latest sensor data (10 items)...");
  const { data: sensorData, error: sensErr } = await supabase
    .from('sensor_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  if (sensErr) console.error("Sens err:", sensErr);
  else console.log("Sensor data:", JSON.stringify(sensorData, null, 2));
}

main();
