#ifndef SECRETS_H
#define SECRETS_H

// Supabase Configuration
const char *supabase_url = "https://inzarwaoykzztuopayaq.supabase.co/rest/v1/sensor_data";
const char *supabase_cmd_url = "https://inzarwaoykzztuopayaq.supabase.co/rest/v1/device_commands";
const char *supabase_device_url = "https://inzarwaoykzztuopayaq.supabase.co/rest/v1/devices";
const char *supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluemFyd2FveWt6enR1b3BheWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDE2MzcsImV4cCI6MjA5MTk3NzYzN30.iZLvGzqjo98RBM5Xb4K-A924jqCdfKX7jSKXnVwk6F0";

// Dashboard Configuration for Auto-Discovery
// Ganti IP di bawah ini dengan IP lokal komputer Anda yang menjalankan dashboard Next.js (misal: 192.168.1.X)
// atau dengan domain publik jika dashboard Anda sudah di-deploy (misal: https://yourdomain.com/api/device/register)
const char *dashboard_register_url = "http://192.168.1.50:3000/api/device/register";

// Wi-Fi Configuration
// You can add your hardcoded Wi-Fi credentials here if needed, or leave them empty
// const char* WIFI_SSID = "your_ssid";
// const char* WIFI_PASSWORD = "your_password";

#endif // SECRETS_H
