// Supabase Edge Function: autopilot-engine
// Dipanggil via Database Webhook setiap kali ada INSERT baru di tabel sensor_data
// Logika: klasifikasi kondisi → tentukan setpoint AC → insert device_commands

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================
// DECISION TREE LOGIC (sesuai model yang dilatih)
// Rules:
//   humidity <= 65.03 → Nyaman
//   humidity > 65.03 AND temperature <= 31.99 → Kurang Nyaman
//   humidity > 65.03 AND temperature > 31.99  → Tidak Nyaman
// ============================================================
function classifyComfort(temperature: number, humidity: number): string {
  if (humidity <= 65.03) return 'Nyaman';
  if (temperature <= 31.99) return 'Kurang Nyaman';
  return 'Tidak Nyaman';
}

// ============================================================
// SETPOINT RULES
// Menentukan parameter AC berdasarkan kondisi kenyamanan + PIR
// ============================================================
interface AcCommand {
  power: 'on' | 'off';
  mode: 'cool' | 'fan' | 'dry';
  temp: number;
  fan: 'auto' | 'high' | 'low';
}

function determineSetpoint(
  comfort: string,
  pir: number,
  noMotionMinutes: number
): AcCommand | null {

  // Kondisi 4: Tidak ada orang lebih dari 10 menit → matikan AC
  if (pir === 0 && noMotionMinutes >= 10) {
    return { power: 'off', mode: 'fan', temp: 26, fan: 'auto' };
  }

  switch (comfort) {
    case 'Tidak Nyaman':
      // Pendinginan maksimal
      return { power: 'on', mode: 'cool', temp: 18, fan: 'high' };

    case 'Kurang Nyaman':
      // Pendinginan sedang untuk turunkan kelembapan
      return { power: 'on', mode: 'cool', temp: 24, fan: 'auto' };

    case 'Nyaman':
      // Mode hemat energi, pertahankan kondisi
      return { power: 'on', mode: 'fan', temp: 26, fan: 'auto' };

    default:
      return null;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req: Request) => {
  // Hanya terima POST dari Supabase webhook
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();

    // Supabase webhook payload: { type: 'INSERT', record: {...}, ... }
    const record = body.record;
    if (!record) {
      return new Response('No record in payload', { status: 400 });
    }

    const { mac_address, temperature, humidity, pir } = record;

    if (!mac_address || temperature == null || humidity == null) {
      return new Response('Missing required sensor fields', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Cek apakah autopilot aktif untuk perangkat ini
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('auto_mode, pir_auto_mode')
      .eq('mac_address', mac_address)
      .maybeSingle();

    // Fallback: cek berdasarkan id=1 jika mac_address tidak ada di app_settings
    let autoMode = settings?.auto_mode ?? false;
    let pirAutoMode = settings?.pir_auto_mode ?? false;

    if (settingsError || !settings) {
      // Coba ambil settings global (id=1)
      const { data: globalSettings } = await supabase
        .from('app_settings')
        .select('auto_mode, pir_auto_mode')
        .eq('id', 1)
        .maybeSingle();

      autoMode = globalSettings?.auto_mode ?? false;
      pirAutoMode = globalSettings?.pir_auto_mode ?? false;
    }

    // Jika autopilot tidak aktif, berhenti di sini
    if (!autoMode) {
      console.log(`[Autopilot] Device ${mac_address}: auto_mode OFF, skip.`);
      return new Response(JSON.stringify({ status: 'skipped', reason: 'auto_mode_off' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Klasifikasi kondisi kenyamanan dengan Decision Tree
    const comfort = classifyComfort(temperature, humidity);
    console.log(`[Autopilot] Device ${mac_address}: T=${temperature}, H=${humidity}, PIR=${pir} → ${comfort}`);

    // 3. Hitung durasi tidak ada gerakan (menit)
    let noMotionMinutes = 0;
    if (pir === 0) {
      // Ambil data sensor 15 menit terakhir untuk cek kapan terakhir ada gerakan
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentData } = await supabase
        .from('sensor_data')
        .select('pir, created_at')
        .eq('mac_address', mac_address)
        .gte('created_at', fifteenMinAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      if (recentData && recentData.length > 0) {
        // Cari data terakhir yang PIR = 1
        const lastMotion = recentData.find((d: any) => d.pir === 1);
        if (lastMotion) {
          const lastMotionTime = new Date(lastMotion.created_at).getTime();
          noMotionMinutes = (Date.now() - lastMotionTime) / 60000;
        } else {
          // Tidak ada gerakan dalam 15 menit terakhir
          noMotionMinutes = 15;
        }
      }
    }

    // 4. PIR Auto-Trigger: jika ada gerakan baru dan pirAutoMode aktif
    //    Cek apakah sebelumnya tidak ada orang (PIR sebelumnya = 0)
    if (pirAutoMode && pir === 1) {
      const tenSecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
      const { data: prevData } = await supabase
        .from('sensor_data')
        .select('pir')
        .eq('mac_address', mac_address)
        .lt('created_at', record.created_at)
        .order('created_at', { ascending: false })
        .limit(3);

      const wasEmpty = prevData && prevData.length > 0 && prevData.every((d: any) => d.pir === 0);

      if (wasEmpty) {
        console.log(`[Autopilot] PIR Auto-Trigger: seseorang baru masuk, hidupkan AC`);
        // Langsung tentukan setpoint berdasarkan kondisi saat ini
      }
    }

    // 5. Tentukan setpoint AC
    const setpoint = determineSetpoint(comfort, pir ?? 0, noMotionMinutes);

    if (!setpoint) {
      return new Response(JSON.stringify({ status: 'no_action' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Ambil model AC dari device atau app_settings
    const { data: deviceData } = await supabase
      .from('devices')
      .select('device_name')
      .eq('mac_address', mac_address)
      .maybeSingle();

    // Ambil model AC terakhir yang digunakan dari device_commands
    const { data: lastCmd } = await supabase
      .from('device_commands')
      .select('payload')
      .eq('mac_address', mac_address)
      .eq('command', 'SET_AC')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let acModel = 'SHARP:A907'; // default
    if (lastCmd?.payload) {
      try {
        const parsed = JSON.parse(lastCmd.payload);
        if (parsed.model) acModel = parsed.model;
      } catch (_) {}
    }

    // 7. Cek apakah perintah terakhir sama persis (hindari spam perintah identik)
    const newPayload = JSON.stringify({
      model: acModel,
      temp: setpoint.temp,
      mode: setpoint.mode,
      fan: setpoint.fan,
      power: setpoint.power,
    });

    if (lastCmd?.payload) {
      // Normalisasi untuk perbandingan
      try {
        const lastParsed = JSON.parse(lastCmd.payload);
        const lastNorm = JSON.stringify({
          model: lastParsed.model,
          temp: lastParsed.temp,
          mode: lastParsed.mode,
          fan: lastParsed.fan,
          power: lastParsed.power,
        });
        if (lastNorm === newPayload) {
          console.log(`[Autopilot] Perintah identik dengan sebelumnya, skip insert.`);
          return new Response(JSON.stringify({ status: 'skipped', reason: 'identical_command' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (_) {}
    }

    // 8. Insert perintah AC ke device_commands
    const { error: cmdError } = await supabase
      .from('device_commands')
      .insert([{
        mac_address,
        command: 'SET_AC',
        payload: newPayload,
        status: 'pending',
      }]);

    if (cmdError) {
      console.error(`[Autopilot] Gagal insert command:`, cmdError);
      return new Response(JSON.stringify({ status: 'error', error: cmdError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Autopilot] Perintah dikirim: ${newPayload}`);

    // 9. Catat ke autopilot_log untuk analisis skripsi
    await supabase.from('autopilot_log').insert([{
      mac_address,
      temperature,
      humidity,
      voc: record.voc ?? null,
      pir: pir ?? 0,
      comfort_status: comfort,
      ac_command: newPayload,
      no_motion_minutes: Math.round(noMotionMinutes),
      action_taken: setpoint.power === 'off' ? 'ac_off' : 'command_sent',
    }]);

    // 10. Update last_comfort_status di app_settings
    await supabase
      .from('app_settings')
      .update({
        last_comfort_status: comfort,
        last_command_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return new Response(
      JSON.stringify({
        status: 'ok',
        comfort,
        setpoint,
        noMotionMinutes: Math.round(noMotionMinutes),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[Autopilot] Unhandled error:', err);
    return new Response(JSON.stringify({ status: 'error', error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
