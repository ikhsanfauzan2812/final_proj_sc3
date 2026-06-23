import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// Helper function to extract public IP from headers
function getClientIp(req: NextRequest): string {
  let ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  
  // If behind a load balancer or proxy, x-forwarded-for can be a comma-separated list
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Clean IPv6 loopback or local prefix if needed
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

// Support GET requests for easy ESP32 firmware implementation
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mac = searchParams.get('mac');
  const name = searchParams.get('name') || 'Smart Climate Controller';

  if (!mac) {
    return NextResponse.json(
      { success: false, error: 'MAC Address (mac) parameter is required.' },
      { status: 400 }
    );
  }

  const clientIp = getClientIp(req);

  try {
    // Upsert the device state — selalu update last_seen saat ESP32 register/heartbeat
    const { data, error } = await supabase
      .from('devices')
      .upsert({
        mac_address: mac.toUpperCase().trim(),
        device_name: name,
        last_ip: clientIp,
        status: 'online',
        last_seen: new Date().toISOString()
      }, { onConflict: 'mac_address' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Perangkat berhasil terdaftar.',
      mac: mac.toUpperCase().trim(),
      captured_ip: clientIp,
      device: data?.[0]
    });
  } catch (err: any) {
    console.error("Device registration error:", err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mendaftarkan perangkat.' },
      { status: 500 }
    );
  }
}

// Support POST requests for modern standard API calls
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mac, name } = body;

    if (!mac) {
      return NextResponse.json(
        { success: false, error: 'mac is required in JSON body.' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);

    const { data, error } = await supabase
      .from('devices')
      .upsert({
        mac_address: mac.toUpperCase().trim(),
        device_name: name || 'Smart Climate Controller',
        last_ip: clientIp,
        status: 'online',
        last_seen: new Date().toISOString()
      }, { onConflict: 'mac_address' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Perangkat berhasil terdaftar via POST.',
      mac: mac.toUpperCase().trim(),
      captured_ip: clientIp,
      device: data?.[0]
    });
  } catch (err: any) {
    console.error("Device registration POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memproses pendaftaran.' },
      { status: 500 }
    );
  }
}
