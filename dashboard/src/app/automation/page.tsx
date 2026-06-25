'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Power, Droplets, Snowflake, Wind, Flame, Plus, Minus, ChevronDown } from 'lucide-react';

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
// ============================================================
interface AcSetpoint {
  power: 'on' | 'off';
  mode: 'cool' | 'fan' | 'dry';
  temp: number;
  fan: 'auto' | 'high' | 'low';
}

function determineSetpoint(comfort: string, pir: number, noMotionMinutes: number, pirOffDelay: number): AcSetpoint | null {
  // Tidak ada orang melebihi durasi yang dikonfigurasi → matikan AC
  if (pir === 0 && noMotionMinutes >= pirOffDelay) {
    return { power: 'off', mode: 'fan', temp: 26, fan: 'auto' };
  }
  switch (comfort) {
    case 'Tidak Nyaman':
      // Pendinginan maksimal
      return { power: 'on', mode: 'cool', temp: 18, fan: 'high' };
    case 'Kurang Nyaman':
      // Pendinginan sedang
      return { power: 'on', mode: 'cool', temp: 24, fan: 'auto' };
    case 'Nyaman':
      // Mode hemat energi
      return { power: 'on', mode: 'fan', temp: 26, fan: 'auto' };
    default:
      return null;
  }
}

export default function Automation() {
  const [autoMode, setAutoMode] = useState(false);
  const [pirAutoMode, setPirAutoMode] = useState(false);
  const [pirOffDelay, setPirOffDelay] = useState(10); // menit, default 10
  const [pirOffDelayInput, setPirOffDelayInput] = useState('10'); // string untuk input field
  const [loading, setLoading] = useState(true);

  // Autopilot status display
  const [autopilotStatus, setAutopilotStatus] = useState<{
    comfort: string;
    lastAction: string;
    lastAt: string;
  } | null>(null);

  // Device mac_address milik user (di-cache setelah fetch pertama)
  const macAddressRef = useRef<string | null>(null);

  // Refs untuk digunakan di dalam closure Realtime tanpa stale state
  const autoModeRef = useRef(false);
  const pirAutoModeRef = useRef(false);
  const pirOffDelayRef = useRef(10);
  const acModelRef = useRef('SHARP:A907');
  const lastCommandRef = useRef<string | null>(null);
  const pirHistoryRef = useRef<{ pir: number; ts: number }[]>([]);

  // States for AC Remote
  const [acModel, setAcModel] = useState('GREE');
  const [acLoading, setAcLoading] = useState(false);
  const [temp, setTemp] = useState(22);
  const [mode, setMode] = useState('cool'); // cool, dry, fan, heat
  const [fanSpeed, setFanSpeed] = useState('auto'); // auto, low, mid, high
  const [isOn, setIsOn] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const minTemp = 16;
  const maxTemp = 30;

  // Keep track of latest state for immediate syncing
  const stateRef = useRef({ temp, mode, fanSpeed, isOn, acModel });
  useEffect(() => {
    stateRef.current = { temp, mode, fanSpeed, isOn, acModel };
    acModelRef.current = acModel;
  }, [temp, mode, fanSpeed, isOn, acModel]);

  // Sync refs saat autoMode/pirAutoMode berubah
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
  useEffect(() => { pirAutoModeRef.current = pirAutoMode; }, [pirAutoMode]);
  useEffect(() => { pirOffDelayRef.current = pirOffDelay; }, [pirOffDelay]);

  // ============================================================
  // AUTOPILOT ENGINE — Subscribe Realtime sensor_data
  // Berjalan selama halaman ini terbuka dan autoMode aktif
  // ============================================================
  useEffect(() => {
    const channelName = 'autopilot-sensor-stream';

    // Bersihkan channel lama
    const existing = supabase.getChannels();
    existing.forEach(c => {
      if (c.topic === `realtime:${channelName}`) supabase.removeChannel(c);
    });

    const channel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sensor_data' },
      async (payload) => {
        // Hanya proses jika autoMode aktif
        if (!autoModeRef.current) return;

        const row = payload.new as any;
        const { mac_address, temperature, humidity, pir, voc } = row;

        // Validasi mac_address cocok dengan perangkat user
        if (!macAddressRef.current || mac_address !== macAddressRef.current) return;
        if (temperature == null || humidity == null) return;

        // Update riwayat PIR (simpan 15 menit terakhir)
        const now = Date.now();
        pirHistoryRef.current = [
          ...pirHistoryRef.current.filter(h => now - h.ts < 15 * 60 * 1000),
          { pir, ts: now }
        ];

        // Hitung durasi tidak ada gerakan
        let noMotionMinutes = 0;
        if (pir === 0) {
          const lastMotion = [...pirHistoryRef.current]
            .reverse()
            .find(h => h.pir === 1);
          if (lastMotion) {
            noMotionMinutes = (now - lastMotion.ts) / 60000;
          } else {
            noMotionMinutes = 15; // tidak ada gerakan dalam window
          }
        }

        // PIR Auto-Trigger: seseorang baru masuk saat autoMode aktif
        if (pirAutoModeRef.current && pir === 1) {
          const prevEntries = pirHistoryRef.current.slice(0, -1); // exclude current
          const wasEmpty = prevEntries.length > 0 && prevEntries.slice(-3).every(h => h.pir === 0);
          if (wasEmpty) {
            console.log('[Autopilot] PIR trigger: seseorang baru masuk, hidupkan AC');
          }
        }

        // Klasifikasi kondisi
        const comfort = classifyComfort(temperature, humidity);

        // Tentukan setpoint
        const setpoint = determineSetpoint(comfort, pir ?? 0, noMotionMinutes, pirOffDelayRef.current);
        if (!setpoint) return;

        // Buat payload perintah
        const model = acModelRef.current || 'GREE';
        const newPayload = JSON.stringify({
          model,
          temp: setpoint.temp,
          mode: setpoint.mode,
          fan: setpoint.fan,
          power: setpoint.power,
        });

        // Hindari spam perintah identik
        if (lastCommandRef.current === newPayload) return;
        lastCommandRef.current = newPayload;

        console.log(`[Autopilot] ${comfort} → ${newPayload}`);

        // Insert ke device_commands
        const { error } = await supabase
          .from('device_commands')
          .insert([{
            mac_address,
            command: 'SET_AC',
            payload: newPayload,
            status: 'pending',
          }]);

        if (error) {
          console.error('[Autopilot] Gagal kirim perintah:', error);
          return;
        }

        // Update status display
        const actionLabel = setpoint.power === 'off'
          ? 'AC dimatikan (tidak ada orang)'
          : `AC → ${setpoint.temp}°C, mode ${setpoint.mode}, kipas ${setpoint.fan}`;

        setAutopilotStatus({
          comfort,
          lastAction: actionLabel,
          lastAt: new Date().toLocaleTimeString('id-ID'),
        });

        // Catat ke autopilot_log jika tabel tersedia
        await supabase.from('autopilot_log').insert([{
          mac_address,
          temperature,
          humidity,
          voc: voc ?? null,
          pir: pir ?? 0,
          comfort_status: comfort,
          ac_command: newPayload,
          no_motion_minutes: Math.round(noMotionMinutes),
          action_taken: setpoint.power === 'off' ? 'ac_off' : 'command_sent',
        }]).then(({ error: logErr }) => {
          if (logErr) console.warn('[Autopilot] Log gagal (mungkin tabel belum ada):', logErr.message);
        });
      }
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // hanya mount sekali, baca state via refs
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Ambil mac_address perangkat milik user
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !macAddressRef.current) {
          const { data: device } = await supabase
            .from('devices')
            .select('mac_address')
            .eq('owner_id', user.id)
            .limit(1)
            .single();
          if (device?.mac_address) {
            macAddressRef.current = device.mac_address;
          }
        }

        const { data, error } = await supabase
          .from('app_settings')
          .select('auto_mode, pir_auto_mode, pir_off_delay')
          .eq('id', 1)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            await supabase.from('app_settings').insert([{ id: 1, auto_mode: false, pir_auto_mode: false, pir_off_delay: 10 }]);
          } else {
            console.error('Error fetching settings:', error);
          }
        } else if (data) {
          setAutoMode(data.auto_mode);
          setPirAutoMode(data.pir_auto_mode || false);
          const delay = data.pir_off_delay ?? 10;
          setPirOffDelay(delay);
          setPirOffDelayInput(String(delay));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchLastState = async () => {
      try {
        const { data, error } = await supabase
          .from('device_commands')
          .select('payload')
          .eq('command', 'SET_AC')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (data && data.payload) {
          const p = JSON.parse(data.payload);
          if (p.model) setAcModel(p.model);
          if (p.temp) setTemp(p.temp);
          if (p.fan) setFanSpeed(p.fan);
          if (p.power) {
            setIsOn(p.power === 'on');
            if (p.power === 'on' && p.mode && p.mode !== 'off') {
              setMode(p.mode);
            }
          }
        }
      } catch (err) {
        console.error("Gagal mengambil state AC terakhir:", err);
      }
    };

    fetchSettings();
    fetchLastState();

    // Subscribe ke perubahan app_settings
    const channelName = 'settings-stream';
    const existingChannels = supabase.getChannels();
    existingChannels.forEach(c => {
      if (c.topic === `realtime:${channelName}`) supabase.removeChannel(c);
    });

    const channel = supabase.channel(channelName);
      
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
      if (payload.new && payload.new.id === 1) {
        if (payload.new.auto_mode !== undefined) setAutoMode(payload.new.auto_mode);
        if (payload.new.pir_auto_mode !== undefined) setPirAutoMode(payload.new.pir_auto_mode);
        if (payload.new.pir_off_delay !== undefined) {
          setPirOffDelay(payload.new.pir_off_delay);
          setPirOffDelayInput(String(payload.new.pir_off_delay));
        }
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleAutoMode = async () => {
    const newValue = !autoMode;
    setAutoMode(newValue);
    
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ auto_mode: newValue })
        .eq('id', 1);
        
      if (error) {
        setAutoMode(!newValue);
        console.error("Gagal mengupdate mode otomatis:", error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePirAutoMode = async () => {
    const newValue = !pirAutoMode;
    setPirAutoMode(newValue);
    
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ pir_auto_mode: newValue, pir_off_delay: pirOffDelay })
        .eq('id', 1);
        
      if (error) {
        setPirAutoMode(!newValue);
        console.error("Gagal mengupdate PIR auto mode:", error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const savePirOffDelay = async (minutes: number) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ pir_off_delay: minutes })
        .eq('id', 1);
      if (error) console.error("Gagal menyimpan durasi PIR:", error);
    } catch (err) {
      console.error(err);
    }
  };

  const sendCommand = async (overrides: Partial<typeof stateRef.current> = {}) => {
    const s = { ...stateRef.current, ...overrides };
    setAcLoading(true);
    
    const payloadJson = {
      model: s.acModel,
      temp: s.temp,
      mode: !s.isOn ? 'off' : s.mode,
      fan: s.fanSpeed,
      power: !s.isOn ? 'off' : 'on'
    };

    const payloadString = JSON.stringify(payloadJson);

    try {
      // Ambil mac_address perangkat milik user yang sedang login
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak terautentikasi');

      if (!macAddressRef.current) {
        const { data: device, error: deviceError } = await supabase
          .from('devices')
          .select('mac_address')
          .eq('owner_id', user.id)
          .limit(1)
          .single();
        if (deviceError || !device) throw new Error('Perangkat tidak ditemukan');
        macAddressRef.current = device.mac_address;
      }

      const { error } = await supabase
        .from('device_commands')
        .insert([
          { command: 'SET_AC', payload: payloadString, status: 'pending', mac_address: macAddressRef.current }
        ]);
      if (error) throw error;
    } catch (err: any) {
      console.error('Gagal mengirim perintah: ' + err.message);
    } finally {
      setAcLoading(false);
    }
  };

  // Calculate arc geometry for circular slider
  const percentage = ((temp - minTemp) / (maxTemp - minTemp));
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (circumference * 270) / 360; // 270 degrees
  const activeLength = arcLength * percentage;

  // Calculate dot position on arc
  const angleDeg = 135 + (percentage * 270);
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = 140 + radius * Math.cos(angleRad);
  const dotY = 140 + radius * Math.sin(angleRad);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateTempFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateTempFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
    sendCommand({ temp: stateRef.current.temp });
  };

  const updateTempFromPointer = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 140; // cx
    const y = e.clientY - rect.top - 140;  // cy
    
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    let shiftedAngle = angle - 135;
    if (shiftedAngle < 0) shiftedAngle += 360;
    
    if (shiftedAngle > 270) {
      if (shiftedAngle < 315) shiftedAngle = 270;
      else shiftedAngle = 0;
    }
    
    const newPercentage = shiftedAngle / 270;
    const newTemp = Math.round(minTemp + newPercentage * (maxTemp - minTemp));
    
    if (newTemp !== stateRef.current.temp) {
      setTemp(newTemp);
    }
  };

  const handleTempChange = (delta: number) => {
    const newTemp = Math.max(minTemp, Math.min(maxTemp, temp + delta));
    if (newTemp !== temp) {
      setTemp(newTemp);
      sendCommand({ temp: newTemp });
    }
  };

  const togglePower = () => {
    const newPower = !isOn;
    setIsOn(newPower);
    sendCommand({ isOn: newPower });
  };

  const changeMode = (newMode: string) => {
    setMode(newMode);
    setIsOn(true);
    sendCommand({ mode: newMode, isOn: true });
  };

  const changeFan = (newFan: string) => {
    setFanSpeed(newFan);
    sendCommand({ fanSpeed: newFan });
  };

  const changeModel = (newModel: string) => {
    setAcModel(newModel);
  };

  // Active color based on AC mode
  let activeColor = '#444';
  if (isOn) {
    if (mode === 'cool') activeColor = '#2196f3';
    else if (mode === 'heat') activeColor = '#ff5252';
    else if (mode === 'dry') activeColor = '#00bcd4';
    else if (mode === 'fan') activeColor = '#00e676';
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div className="page-header">
        <h1>Smart Auto-Pilot</h1>
        <p className="page-subtitle">Pusat kendali cerdas yang memastikan ruangan Anda selalu nyaman secara otomatis.</p>
      </div>

      {/* Grid Container split into two independent flex columns, aligned to start */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px', width: '100%', alignItems: 'start' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
          
          {/* Master Switch Panel */}
          <div className="glass-card" style={{ width: '100%', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.3s ease' }}>
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>Master Switch</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '30px', textAlign: 'center' }}>
              Saat mode ini diaktifkan, perangkat akan secara otomatis menyesuaikan iklim ruangan untuk memberikan Anda kenyamanan terbaik tanpa perlu repot.
            </p>

            {loading ? (
              <div style={{ color: '#aaa' }}>Memuat status...</div>
            ) : (
              <div 
                onClick={toggleAutoMode}
                style={{
                  width: '120px',
                  height: '60px',
                  borderRadius: '30px',
                  background: autoMode ? 'linear-gradient(to right, #00b09b, #96c93d)' : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: autoMode ? '0 10px 20px rgba(0, 176, 155, 0.3)' : 'inset 0 2px 10px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  transform: autoMode ? 'translateX(60px)' : 'translateX(0)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }} />
              </div>
            )}

            <div style={{ 
              marginTop: '25px', 
              padding: '10px 20px', 
              borderRadius: '20px', 
              border: `1px solid ${autoMode ? '#2ecc71' : '#e74c3c'}`,
              color: autoMode ? '#2ecc71' : '#e74c3c',
              fontWeight: 'bold'
            }}>
              STATUS: {autoMode ? 'AKTIF (AUTO)' : 'NON-AKTIF (MANUAL)'}
            </div>

            {/* Autopilot Status Panel — tampil saat autoMode aktif */}
            {autoMode && autopilotStatus && (
              <div style={{
                marginTop: '20px',
                width: '100%',
                padding: '15px 20px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'left',
              }}>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Status Terakhir Autopilot
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: autopilotStatus.comfort === 'Nyaman'
                      ? 'rgba(46,204,113,0.2)' : autopilotStatus.comfort === 'Kurang Nyaman'
                      ? 'rgba(241,196,15,0.2)' : 'rgba(231,76,60,0.2)',
                    color: autopilotStatus.comfort === 'Nyaman' ? '#2ecc71'
                      : autopilotStatus.comfort === 'Kurang Nyaman' ? '#f1c40f' : '#e74c3c',
                    border: `1px solid ${autopilotStatus.comfort === 'Nyaman' ? '#2ecc71'
                      : autopilotStatus.comfort === 'Kurang Nyaman' ? '#f1c40f' : '#e74c3c'}`,
                  }}>
                    {autopilotStatus.comfort}
                  </span>
                  <span style={{ fontSize: '11px', color: '#666' }}>{autopilotStatus.lastAt}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#ccc' }}>
                  → {autopilotStatus.lastAction}
                </div>
              </div>
            )}

            {autoMode && !autopilotStatus && (
              <div style={{ marginTop: '15px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                Menunggu data sensor masuk...
              </div>
            )}

            {/* Nested Remote Control UI inside Master Switch when disabled */}
            {!autoMode && (
              <div style={{ width: '100%', maxWidth: '380px', marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h3 style={{ color: '#fff', marginBottom: '5px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span>🎮</span> Kontrol AC Manual
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Autopilot mati. Atur setpoint AC secara manual di bawah.
                  </p>
                </div>
                
                <div style={{ width: '100%' }}>
                  {/* Model Selector */}
                  <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Target AC:</span>
                    <select 
                      value={acModel} 
                      onChange={(e) => changeModel(e.target.value)}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: '6px', 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        outline: 'none',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="DAIKIN" style={{ background: '#1c1c1c', color: '#fff' }}>DAIKIN</option>
                      <option value="FUJITSU" style={{ background: '#1c1c1c', color: '#fff' }}>FUJITSU</option>
                      <option value="GREE" style={{ background: '#1c1c1c', color: '#fff' }}>GREE</option>
                      <option value="HAIER" style={{ background: '#1c1c1c', color: '#fff' }}>HAIER</option>
                      <option value="HITACHI" style={{ background: '#1c1c1c', color: '#fff' }}>HITACHI</option>
                      <option value="LG" style={{ background: '#1c1c1c', color: '#fff' }}>LG</option>
                      <option value="MIDEA" style={{ background: '#1c1c1c', color: '#fff' }}>MIDEA</option>
                      <option value="MITSUBISHI" style={{ background: '#1c1c1c', color: '#fff' }}>MITSUBISHI</option>
                      <option value="MITSUBISHI_HEAVY" style={{ background: '#1c1c1c', color: '#fff' }}>MITSUBISHI HEAVY</option>
                      <option value="PANASONIC" style={{ background: '#1c1c1c', color: '#fff' }}>PANASONIC</option>
                      <option value="SAMSUNG" style={{ background: '#1c1c1c', color: '#fff' }}>SAMSUNG</option>
                      <option value="SANYO" style={{ background: '#1c1c1c', color: '#fff' }}>SANYO</option>
                      <option value="SHARP" style={{ background: '#1c1c1c', color: '#fff' }}>SHARP</option>
                      <option value="SHARP:A705" style={{ background: '#1c1c1c', color: '#fff' }}>SHARP A705</option>
                      <option value="SHARP:A903" style={{ background: '#1c1c1c', color: '#fff' }}>SHARP A903</option>
                      <option value="SHARP:A907" style={{ background: '#1c1c1c', color: '#fff' }}>SHARP A907</option>
                      <option value="TCL" style={{ background: '#1c1c1c', color: '#fff' }}>TCL</option>
                      <option value="TOSHIBA" style={{ background: '#1c1c1c', color: '#fff' }}>TOSHIBA</option>
                      <option value="WHIRLPOOL" style={{ background: '#1c1c1c', color: '#fff' }}>WHIRLPOOL</option>
                    </select>
                  </div>

                  {/* HA Climate Card (Compact size) */}
                  <div style={{ position: 'relative', background: '#151515', border: '1px solid #2a2a2a', borderRadius: '18px', boxShadow: '0 10px 25px rgba(0,0,0,0.4)', overflow: 'hidden', padding: '20px' }}>
                    
                    {acLoading && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: activeColor, opacity: 0.7, animation: 'pulse 1s infinite' }}></div>
                    )}

                    {/* Circular Dial Area */}
                    <div style={{ position: 'relative', width: '250px', height: '270px', margin: '0 auto' }}>
                      
                      {/* SVG Arc Track & Slider */}
                      <svg 
                        ref={svgRef}
                        width="250" height="250" viewBox="0 0 280 280" 
                        style={{ position: 'absolute', top: 0, left: 0, touchAction: 'none' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                      >
                        <g style={{ transform: 'rotate(135deg)', transformOrigin: 'center' }}>
                          {/* Background Track */}
                          <circle 
                            cx="140" cy="140" r={radius} 
                            fill="none" stroke="#2a2a2a" strokeWidth="18" strokeLinecap="round"
                            strokeDasharray={`${arcLength} ${circumference}`}
                          />
                          {/* Active Track */}
                          <circle 
                            cx="140" cy="140" r={radius} 
                            fill="none" stroke={activeColor} strokeWidth="18" strokeLinecap="round"
                            strokeDasharray={`${activeLength} ${circumference}`}
                            style={{ transition: isDragging ? 'none' : 'stroke-dasharray 0.3s ease-out, stroke 0.3s' }}
                          />
                        </g>
                        
                        {/* Drag Dot */}
                        <circle 
                          cx={dotX} cy={dotY} r="12" 
                          fill="#fff"
                          style={{ 
                            transition: isDragging ? 'none' : 'cx 0.3s ease-out, cy 0.3s ease-out',
                            cursor: 'grab', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))' 
                          }}
                        />
                      </svg>

                      {/* Center Content */}
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '250px', height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ color: '#888', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize', marginBottom: '2px' }}>
                          {isOn ? mode : 'Off'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', color: isOn ? '#fff' : '#555' }}>
                          <span style={{ fontSize: '56px', fontWeight: 400, lineHeight: 1, marginLeft: '8px' }}>{temp}</span>
                          <span style={{ fontSize: '18px', fontWeight: 500, marginTop: '2px' }}>°C</span>
                        </div>
                      </div>

                      {/* + / - Buttons */}
                      <div style={{ position: 'absolute', bottom: '10px', left: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 10 }}>
                        <button 
                          onClick={() => handleTempChange(-1)}
                          style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#252525', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }}
                        >
                          <Minus size={18} />
                        </button>
                        <button 
                          onClick={() => handleTempChange(1)}
                          style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#252525', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Controls Area */}
                    <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      
                      {/* Fan Speed Selector */}
                      <div style={{ position: 'relative' }}>
                        <select 
                          value={fanSpeed}
                          onChange={(e) => changeFan(e.target.value)}
                          style={{ 
                            width: '100%', padding: '10px 15px', borderRadius: '8px', 
                            background: '#252525', border: 'none', color: '#ccc', fontSize: '14px',
                            appearance: 'none', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          <option value="auto" style={{ background: '#252525', color: '#fff' }}>• Auto Fan</option>
                          <option value="low" style={{ background: '#252525', color: '#fff' }}>• Low Fan</option>
                          <option value="mid" style={{ background: '#252525', color: '#fff' }}>• Mid Fan</option>
                          <option value="high" style={{ background: '#252525', color: '#fff' }}>• High Fan</option>
                        </select>
                        <ChevronDown size={16} color="#666" style={{ position: 'absolute', right: '15px', top: '12px', pointerEvents: 'none' }} />
                      </div>

                      {/* Mode Icons Row */}
                      <div style={{ display: 'flex', background: '#252525', borderRadius: '8px', padding: '4px', gap: '4px' }}>
                        
                        <button 
                          onClick={togglePower}
                          style={{ flex: 1, padding: '10px 0', border: 'none', background: !isOn ? '#444' : 'transparent', borderRadius: '6px', color: !isOn ? '#fff' : '#666', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                        >
                          <Power size={18} />
                        </button>

                        <button 
                          onClick={() => changeMode('dry')}
                          style={{ flex: 1, padding: '10px 0', border: 'none', background: isOn && mode === 'dry' ? 'rgba(0, 188, 212, 0.2)' : 'transparent', borderRadius: '6px', color: isOn && mode === 'dry' ? '#00bcd4' : '#666', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                        >
                          <Droplets size={18} />
                        </button>

                        <button 
                          onClick={() => changeMode('cool')}
                          style={{ flex: 1, padding: '10px 0', border: 'none', background: isOn && mode === 'cool' ? '#2196f3' : 'transparent', borderRadius: '6px', color: isOn && mode === 'cool' ? '#fff' : '#666', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                        >
                          <Snowflake size={18} />
                        </button>

                        <button 
                          onClick={() => changeMode('heat')}
                          style={{ flex: 1, padding: '10px 0', border: 'none', background: isOn && mode === 'heat' ? 'rgba(255, 82, 82, 0.2)' : 'transparent', borderRadius: '6px', color: isOn && mode === 'heat' ? '#ff5252' : '#666', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                        >
                          <Flame size={18} />
                        </button>

                        <button 
                          onClick={() => changeMode('fan')}
                          style={{ flex: 1, padding: '10px 0', border: 'none', background: isOn && mode === 'fan' ? 'rgba(0, 230, 118, 0.2)' : 'transparent', borderRadius: '6px', color: isOn && mode === 'fan' ? '#00e676' : '#666', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center' }}
                        >
                          <Wind size={18} />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PIR Motion Auto-Trigger Toggle Panel */}
          <div className="glass-card" style={{ width: '100%', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>PIR Motion Auto-Trigger</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '40px', textAlign: 'center' }}>
              Mengandalkan sensor gerak untuk secara instan menghidupkan AC saat ada seseorang yang baru masuk ke dalam ruangan.
            </p>

            <div 
              onClick={togglePirAutoMode}
              style={{
                width: '120px',
                height: '60px',
                borderRadius: '30px',
                background: pirAutoMode ? 'linear-gradient(to right, #00b09b, #96c93d)' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                padding: '5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: pirAutoMode ? '0 10px 20px rgba(0, 176, 155, 0.3)' : 'inset 0 2px 10px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                transform: pirAutoMode ? 'translateX(60px)' : 'translateX(0)',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }} />
            </div>

            <div style={{ 
              marginTop: '30px', 
              padding: '10px 20px', 
              borderRadius: '20px', 
              border: `1px solid ${pirAutoMode ? '#2ecc71' : '#e74c3c'}`,
              color: pirAutoMode ? '#2ecc71' : '#e74c3c',
              fontWeight: 'bold'
            }}>
              STATUS: {pirAutoMode ? 'AKTIF (AUTO)' : 'NON-AKTIF (MANUAL)'}
            </div>

            {/* Durasi sebelum AC dimatikan — muncul saat pirAutoMode aktif */}
            {pirAutoMode && (
              <div style={{
                marginTop: '30px',
                width: '100%',
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Matikan AC setelah tidak ada gerakan selama
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={pirOffDelayInput}
                    onChange={(e) => setPirOffDelayInput(e.target.value)}
                    onBlur={() => {
                      const parsed = parseInt(pirOffDelayInput, 10);
                      const clamped = isNaN(parsed) ? 10 : Math.max(1, Math.min(60, parsed));
                      setPirOffDelay(clamped);
                      setPirOffDelayInput(String(clamped));
                      savePirOffDelay(clamped);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    style={{
                      width: '80px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: '700',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: '#ccc', fontSize: '15px' }}>menit</span>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
                    (1–60 menit)
                  </span>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                  Tekan Enter atau klik di luar kolom untuk menyimpan.
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
          
          {/* Explanation Panel */}
          <div className="glass-card" style={{ width: '100%', padding: '30px', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'rgba(0, 242, 254, 0.2)' }}>
            <h3 style={{ color: '#00f2fe', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>✨</span> Sentuhan Cerdas
            </h3>
            <p style={{ color: '#ddd', fontSize: '15px', lineHeight: '1.6' }}>
              Kenyamanan adalah prioritas utama <strong>Smart Compact Climate Controller</strong>. 
              Sistem kami secara diam-diam memonitor ruangan Anda untuk menciptakan atmosfer yang sempurna.
            </p>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #f1c40f' }}>
                <strong style={{ color: '#f1c40f' }}>Kondisi 1: Tidak Ada Orang (PIR Aman)</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika ruangan kosong selama periode waktu tertentu, sistem akan secara otomatis menaikkan setpoint AC (misal ke 26°C) atau mematikannya untuk menghemat listrik.</p>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #e74c3c' }}>
                <strong style={{ color: '#e74c3c' }}>Kondisi 2: Suhu / VOC Tinggi</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika terdeteksi suhu panas di atas ambang batas wajar dan ruangan terisi, sistem akan otomatis menurunkan setpoint AC (Pendinginan Ekstra) dan memaksimalkan kecepatan kipas.</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #2ecc71' }}>
                <strong style={{ color: '#2ecc71' }}>Kondisi 3: Zona Nyaman</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika rasio Suhu dan Kelembapan (Comfort Index) sudah ideal (suhu 22-24°C, kelembapan &lt; 65%), sistem akan menahan setpoint AC pada mode Auto Fan untuk menjaga suhu stabil secara efisien.</p>
              </div>
            </div>
          </div>

          {/* PIR Explanation Panel */}
          <div className="glass-card" style={{ width: '100%', padding: '30px', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'rgba(0, 242, 254, 0.2)' }}>
            <h3 style={{ color: '#00f2fe', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🚶‍♂️</span> Smart Motion Sense
            </h3>
            <p style={{ color: '#ddd', fontSize: '15px', lineHeight: '1.6' }}>
              Fitur cerdas ini memungkinkan AC untuk bereaksi langsung terhadap kehadiran Anda, meminimalkan waktu tunggu pendinginan ruangan.
            </p>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #3498db' }}>
                <strong style={{ color: '#3498db' }}>Kehadiran Spontan</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Sistem memantau perubahan status sensor gerak (PIR). Saat sebelumnya ruangan kosong dan tiba-tiba terdeteksi gerakan, sistem akan menembakkan perintah ON ke AC seketika.</p>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '10px', borderLeft: '3px solid #9b59b6' }}>
                <strong style={{ color: '#9b59b6' }}>Sinergi dengan Auto-Pilot</strong>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#bbb' }}>Jika Master Switch menyala, AC yang dihidupkan oleh sensor gerak ini akan langsung menyesuaikan suhunya dengan rekomendasi iklim terbaik saat itu.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
